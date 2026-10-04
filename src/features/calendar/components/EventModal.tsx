"use client";

import { App, Button, Col, DatePicker, Flex, Form, Grid, Input, Modal, Row, Select, Switch, TimePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ColorSwatches, IconGrid } from "@/components/ui";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { useMembers } from "@/features/members/hooks";
import { useT } from "@/i18n";
import type { AppearanceColor, AppearanceIcon } from "@/lib/appearance";
import { usePermission } from "@/lib/auth/hooks";
import { EVENT_LIMITS, REPEATS, type CalendarEvent, type Repeat } from "../domain";
import { useEventActions } from "../hooks";

interface FormValues {
  title: string;
  allDay: boolean;
  date: Dayjs;
  time: [Dayjs, Dayjs];
  days: [Dayjs, Dayjs];
  repeat: Repeat;
  participantIds: string[];
  color: AppearanceColor;
  icon?: AppearanceIcon;
  notes?: string;
}

interface EventModalProps {
  open: boolean;
  /** Evento a editar, o `undefined` para crear. */
  event?: CalendarEvent;
  /** Día preseleccionado al crear. */
  day?: Dayjs;
  onClose: () => void;
}

export function EventModal({ open, event, day, onClose }: EventModalProps) {
  const t = useT();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { modal } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const members = useMembers() ?? [];
  const { create, update, remove } = useEventActions();
  const canManage = usePermission("calendar.manage");
  const [saving, setSaving] = useState(false);
  const allDay = Form.useWatch("allDay", form) as boolean | undefined;
  const color = (Form.useWatch("color", form) as AppearanceColor | undefined) ?? "blue";

  useEffect(() => {
    if (!open) return;
    if (event) {
      const start = dayjs(event.start);
      const end = dayjs(event.end);
      form.setFieldsValue({
        title: event.title,
        allDay: event.allDay,
        date: start,
        time: [start, end],
        days: [start, end],
        repeat: event.repeat,
        participantIds: event.participantIds,
        color: event.color,
        icon: event.icon,
        notes: event.notes,
      });
    } else {
      const base = (day ?? dayjs()).startOf("day");
      form.setFieldsValue({
        title: "",
        allDay: false,
        date: base,
        time: [base.hour(10), base.hour(11)],
        days: [base, base],
        repeat: "none",
        participantIds: [],
        color: "blue",
        icon: undefined,
        notes: undefined,
      });
    }
  }, [open, event, day, form]);

  async function onOk() {
    const values = await form.validateFields();
    const [start, end] = values.allDay
      ? [values.days[0].startOf("day"), values.days[1].startOf("day")]
      : [values.date.hour(values.time[0].hour()).minute(values.time[0].minute()), values.date.hour(values.time[1].hour()).minute(values.time[1].minute())];
    const input = {
      title: values.title,
      start: start.valueOf(),
      end: end.valueOf(),
      allDay: values.allDay,
      repeat: values.repeat,
      participantIds: values.participantIds,
      color: values.color,
      icon: values.icon,
      notes: values.notes,
    };
    setSaving(true);
    const ok = event ? await update(event.id, input) : await create(input);
    setSaving(false);
    if (ok) onClose();
  }

  const confirmDelete = () =>
    event &&
    modal.confirm({
      title: t("calendar.deleteConfirm", { title: event.title }),
      content: event.repeat !== "none" ? t("calendar.repeatNote") : undefined,
      okText: t("calendar.delete"),
      okButtonProps: { danger: true },
      cancelText: t("common.cancel"),
      onOk: async () => {
        if (await remove(event.id)) onClose();
      },
    });

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t(event ? "calendar.editEvent" : "calendar.newEvent")}
      width={620}
      destroyOnHidden
      footer={
        <Flex justify="space-between" gap={8} wrap>
          <span>
            {event && canManage && (
              <Button danger icon={<Trash2 />} onClick={confirmDelete}>
                {t("calendar.delete")}
              </Button>
            )}
          </span>
          <Flex gap={8}>
            <Button onClick={onClose}>{t("common.cancel")}</Button>
            {canManage && (
              <Button type="primary" loading={saving} onClick={onOk}>
                {t("inventory.item.save")}
              </Button>
            )}
          </Flex>
        </Flex>
      }
    >
      <Form form={form} layout="vertical" requiredMark={false} disabled={!canManage} onFinish={onOk}>
        <Form.Item
          name="title"
          label={t("calendar.fields.title")}
          rules={[{ required: true, whitespace: true, message: t("inventory.form.nameRequired") }, { max: EVENT_LIMITS.titleMaxLength }]}
        >
          <Input placeholder={t("calendar.fields.titlePlaceholder")} maxLength={EVENT_LIMITS.titleMaxLength} autoFocus />
        </Form.Item>
        <Row gutter={12} align="bottom">
          <Col xs={24} md={4}>
            <Form.Item name="allDay" label={t("calendar.allDay")} valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
          {allDay ? (
            isMobile ? (
              <>
                <Col xs={24}>
                  <Form.Item name={["days", 0]} label={t("calendar.fields.startDate")} rules={[{ required: true }]}>
                    <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" allowClear={false} />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item name={["days", 1]} label={t("calendar.fields.endDate")} rules={[{ required: true }]}>
                    <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" allowClear={false} />
                  </Form.Item>
                </Col>
              </>
            ) : <Col md={20}>
              <Form.Item name="days" label={t("calendar.fields.dates")} rules={[{ required: true }]}>
                <DatePicker.RangePicker style={{ width: "100%" }} format="DD/MM/YYYY" allowClear={false} />
              </Form.Item>
            </Col>
          ) : (
            <>
              <Col xs={24} md={9}>
                <Form.Item name="date" label={t("calendar.fields.date")} rules={[{ required: true }]}>
                  <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" allowClear={false} />
                </Form.Item>
              </Col>
              {isMobile ? (
                <>
                  <Col xs={24}>
                    <Form.Item name={["time", 0]} label={t("calendar.fields.startTime")} rules={[{ required: true }]}>
                      <TimePicker style={{ width: "100%" }} format="HH:mm" minuteStep={5} allowClear={false} />
                    </Form.Item>
                  </Col>
                  <Col xs={24}>
                    <Form.Item name={["time", 1]} label={t("calendar.fields.endTime")} rules={[{ required: true }]}>
                      <TimePicker style={{ width: "100%" }} format="HH:mm" minuteStep={5} allowClear={false} />
                    </Form.Item>
                  </Col>
                </>
              ) : <Col md={11}>
                <Form.Item name="time" label={t("calendar.fields.time")} rules={[{ required: true }]}>
                  <TimePicker.RangePicker style={{ width: "100%" }} format="HH:mm" minuteStep={5} allowClear={false} />
                </Form.Item>
              </Col>}
            </>
          )}
        </Row>
        <Row gutter={12}>
          <Col xs={24} sm={10}>
            <Form.Item name="repeat" label={t("calendar.fields.repeat")}>
              <Select options={REPEATS.map((repeat) => ({ value: repeat, label: t(`calendar.repeats.${repeat}`) }))} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={14}>
            <Form.Item name="participantIds" label={t("calendar.fields.participants")}>
              <Select
                mode="multiple"
                // Buscar por nombre (por defecto antd filtra por `value`, que es el id).
                showSearch={{ optionFilterProp: "label" }}
                placeholder={t("calendar.everyone")}
                optionLabelProp="label"
                options={members.map((member) => ({
                  value: member.id,
                  label: member.name,
                  title: member.name,
                }))}
                optionRender={(option) => {
                  const member = members.find((candidate) => candidate.id === option.value);
                  return member ? (
                    <Flex align="center" gap={8}>
                      <MemberAvatar member={member} size={22} />
                      {member.name}
                    </Flex>
                  ) : (
                    option.label
                  );
                }}
              />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="color" label={t("appearance.color")}>
          <ColorSwatches fallback="blue" />
        </Form.Item>
        <Form.Item name="icon" label={t("appearance.icon")}>
          <IconGrid fallback="star" color={color} />
        </Form.Item>
        <Form.Item name="notes" label={t("calendar.fields.notes")}>
          <Input.TextArea rows={2} maxLength={EVENT_LIMITS.notesMaxLength} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

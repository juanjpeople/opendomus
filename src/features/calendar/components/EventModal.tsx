"use client";

import { App, Button, Col, DatePicker, Flex, Form, Grid, Input, Modal, Row, Select, Switch, TimePicker } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ColorSwatches, IconGrid, PrivacySelect } from "@/components/ui";
import { MemberAvatar } from "@/components/ui/MemberAvatar";
import { useMembers } from "@/features/members/hooks";
import { useI18n } from "@/i18n";
import type { AppearanceColor, AppearanceIcon } from "@/lib/appearance";
import { usePermission } from "@/lib/auth/hooks";
import type { Privacy } from "@/lib/sync/scope";
import { EVENT_LIMITS, EVENT_KINDS, REPEATS, type CalendarEvent, type Repeat, type EventKind } from "../domain";
import { useEventActions } from "../hooks";

interface FormValues {
  title: string;
  privacy?: Privacy;
  allDay: boolean;
  date: Dayjs;
  time: [Dayjs, Dayjs];
  days: [Dayjs, Dayjs];
  repeat: Repeat;
  repeatUntil?: Dayjs;
  eventKind: EventKind;
  homeworkDone?: boolean;
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
  const { t } = useI18n();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const { modal } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const members = useMembers() ?? [];
  const { create, update, remove } = useEventActions();
  const canManage = usePermission("calendar.manage");
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const allDay = Form.useWatch("allDay", form) as boolean | undefined;
  const eventKind = Form.useWatch("eventKind", form) as EventKind | undefined;
  const repeat = Form.useWatch("repeat", form) as Repeat | undefined;
  const color = (Form.useWatch("color", form) as AppearanceColor | undefined) ?? "blue";

  useEffect(() => {
    if (!open) return;
    if (event) {
      const start = dayjs(event.start);
      const end = dayjs(event.end);
      form.setFieldsValue({
        title: event.title,
        privacy: event.privacy ?? "family",
        allDay: event.allDay,
        date: start,
        time: [start, end],
        days: [start, end],
        repeat: event.repeat,
        repeatUntil: event.repeatUntil === undefined ? undefined : dayjs(event.repeatUntil),
        eventKind: event.eventKind ?? "event",
        homeworkDone: event.homeworkDone ?? false,
        participantIds: event.participantIds,
        color: event.color,
        icon: event.icon,
        notes: event.notes,
      });
    } else {
      const base = (day ?? dayjs()).startOf("day");
      form.setFieldsValue({
        title: "",
        privacy: "family",
        allDay: false,
        date: base,
        time: [base.hour(10), base.hour(11)],
        days: [base, base],
        repeat: "none",
        repeatUntil: undefined,
        eventKind: "event",
        homeworkDone: false,
        participantIds: [],
        color: "blue",
        icon: undefined,
        notes: undefined,
      });
    }
  }, [open, event, day, form]);

  async function onOk() {
    if (pending.current || !canManage) return;
    pending.current = true;
    try {
      const values = await form.validateFields().catch(() => null);
      if (!values) return;
      const [start, end] = values.allDay
        ? [values.days[0].startOf("day"), values.days[1].startOf("day")]
        : [values.date.hour(values.time[0].hour()).minute(values.time[0].minute()), values.date.hour(values.time[1].hour()).minute(values.time[1].minute())];
      const input = {
        title: values.title,
        privacy: values.privacy,
        start: start.valueOf(),
        end: end.valueOf(),
        allDay: values.allDay,
        repeat: values.repeat,
        repeatUntil: values.repeat !== "none" ? values.repeatUntil?.endOf("day").valueOf() : undefined,
        eventKind: values.eventKind,
        homeworkDone: values.eventKind === "homework" ? values.homeworkDone : undefined,
        participantIds: values.participantIds,
        color: values.color,
        icon: values.icon,
        notes: values.notes,
      };
      setSaving(true);
      const ok = event ? await update(event.id, input) : await create(input);
      if (ok) onClose();
    } finally { pending.current = false; setSaving(false); }
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
      onCancel={() => { if (!pending.current) onClose(); }}
      closable={!saving}
      title={t(event ? "calendar.editEvent" : "calendar.newEvent")}
      width={620}
      destroyOnHidden
      footer={
        <Flex justify="space-between" gap={8} wrap>
          <span>
            {event && canManage && (
              <Button danger icon={<Trash2 />} disabled={saving} onClick={confirmDelete}>
                {t("calendar.delete")}
              </Button>
            )}
          </span>
          <Flex gap={8}>
            <Button disabled={saving} onClick={onClose}>{t("common.cancel")}</Button>
            {canManage && (
              <Button type="primary" loading={saving} disabled={saving} aria-label={t("inventory.item.save")} onClick={onOk}>
                {t("inventory.item.save")}
              </Button>
            )}
          </Flex>
        </Flex>
      }
    >
      <Form form={form} layout="vertical" requiredMark={false} disabled={!canManage || saving} aria-busy={saving} onFinish={onOk}>
        <Form.Item name="eventKind" label={t("school.eventType")}>
          <Select options={EVENT_KINDS.map((value) => ({ value, label: ({ event: t("school.event"), class: t("school.schoolSubject"), homework: t("school.homework"), break: t("school.noSchool"), holiday: t("school.customHoliday") })[value] }))} onChange={(kind: EventKind) => {
            if (kind === "class") form.setFieldsValue({ repeat: "weekly", allDay: false });
            else if (kind === "break" || kind === "holiday" || kind === "homework") form.setFieldsValue({ repeat: "none", allDay: true });
          }} />
        </Form.Item>
        <Form.Item
          name="title"
          label={t("calendar.fields.title")}
          rules={[{ required: true, whitespace: true, message: t("errors.validation.nameRequired") }, { max: EVENT_LIMITS.titleMaxLength }]}
        >
          <Input placeholder={t("calendar.fields.titlePlaceholder")} maxLength={EVENT_LIMITS.titleMaxLength} autoFocus />
        </Form.Item>
        <Form.Item name="privacy" label={t("privacy.label")}>
          <PrivacySelect />
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
              <Select disabled={eventKind === "class" || !canManage || saving} options={REPEATS.map((repeat) => ({ value: repeat, label: t(`calendar.repeats.${repeat}`) }))} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={14}>
            <Form.Item name="participantIds" label={t("calendar.fields.participants")} rules={eventKind === "class" ? [{ required: true, type: "array", min: 1, message: t("school.participantsRequired") }] : []}>
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
        {repeat !== "none" && <Form.Item name="repeatUntil" label={t("school.repeatUntil")} extra={eventKind === "class" ? (t("school.classHelp")) : undefined} rules={eventKind === "class" ? [{ required: true, message: t("school.termRequired") }] : []}>
          <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
        </Form.Item>}
        {eventKind === "homework" && <Form.Item name="homeworkDone" label={t("school.homeworkChecked")} valuePropName="checked"><Switch /></Form.Item>}
        <Form.Item name="color" label={t("appearance.color")}>
          <ColorSwatches fallback="blue" />
        </Form.Item>
        <Form.Item name="icon" label={t("appearance.icon")}>
          <IconGrid fallback="star" color={color} />
        </Form.Item>
        <Form.Item name="notes" label={eventKind === "class" ? (t("school.backpack")) : t("calendar.fields.notes")}>
          <Input.TextArea rows={2} maxLength={EVENT_LIMITS.notesMaxLength} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

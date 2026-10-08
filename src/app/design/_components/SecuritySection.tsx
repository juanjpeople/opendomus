"use client";

import { Alert, App, Button, Col, Flex, Row, Table, Tag, Typography, theme, type TableColumnsType } from "antd";
import { Check, ShieldAlert, X } from "lucide-react";
import { Can } from "@/components/auth/Can";
import { useT } from "@/i18n";
import { can, PERMISSIONS, ROLES, type Permission } from "@/lib/auth/permissions";
import { useCurrentUser } from "@/lib/auth/session";
import { deleteInventoryItem } from "@/features/inventory/service";
import { getErrorMessage } from "@/lib/errors";
import { DemoBlock, DemoLabel } from "./DemoBlock";

/** Un perfil de ejemplo por rol, para evaluar la matriz con la misma función `can` que usa la app. */
const SAMPLE_ACTOR_BY_ROLE = Object.fromEntries(ROLES.map((role) => [role, { id: `sample-${role}`, name: role, role }]));

export function SecuritySection() {
  const t = useT();
  const user = useCurrentUser();

  return (
    <>
      <Alert
        type="warning"
        showIcon
        icon={<ShieldAlert />}
        title="Permisos locales y controles de sincronización"
        description={<>
          <Typography.Paragraph>En este dispositivo, la interfaz y los servicios aplican la matriz de permisos. Quien controla el navegador puede modificar sus datos locales.</Typography.Paragraph>
          <Typography.Paragraph>En la nube, el servidor verifica la sesión, la pertenencia a la casa, el nivel de acceso y la firma de los cambios. No puede leer su contenido cifrado.</Typography.Paragraph>
          <Typography.Paragraph style={{ marginBottom: 0 }}>Al recibir y descifrar un cambio, cada dispositivo comprueba los permisos del autor antes de aplicarlo. Ocultar un botón con Can no reemplaza estas comprobaciones.</Typography.Paragraph>
        </>}
      />

      <MatrixBlock />

      <DemoBlock
        id="can"
        title="<Can>: ocultar o deshabilitar"
        description={
          <>
            Tu perfil actual es <Tag color="processing">{user ? t(`roles.${user.role}`) : "—"}</Tag>
            Cambialo desde el menú de usuario (arriba a la derecha) para ver cómo reaccionan.
          </>
        }
        code={`
// Ocultar (default): no se renderiza nada
<Can perform="settings.design">
  <Button>Configuración avanzada</Button>
</Can>

// Deshabilitar con explicación
<Can perform="finance.pay" fallback="disable" reason="Solo adultos pueden pagar">
  {(disabled) => <Button type="primary" disabled={disabled}>Pagar facturas</Button>}
</Can>

// En lógica: hook
const canDelete = usePermission("inventory.delete");

// Página entera
<RequirePermission perform="settings.design">...</RequirePermission>
`}
      >
        <Row gutter={[24, 24]}>
          <Col xs={24} md={12}>
            <DemoLabel>fallback=&quot;hide&quot; · requiere settings.design</DemoLabel>
            <Can perform="settings.design">
              <Alert type="success" showIcon title="Visible solo para administradores" />
            </Can>
          </Col>
          <Col xs={24} md={12}>
            <DemoLabel>fallback=&quot;disable&quot; · requiere finance.pay</DemoLabel>
            <Can perform="finance.pay" fallback="disable" reason="Solo adultos pueden pagar">
              {(disabled) => (
                <Button type="primary" disabled={disabled}>
                  Pagar facturas
                </Button>
              )}
            </Can>
          </Col>
        </Row>
      </DemoBlock>

      <ServiceGuardBlock />
    </>
  );
}

function MatrixBlock() {
  const t = useT();
  const { token } = theme.useToken();
  const user = useCurrentUser();

  const columns: TableColumnsType<{ permission: Permission }> = [
    {
      title: "Permiso",
      key: "permission",
      render: (_, { permission }) => (
        <Flex vertical>
          <Typography.Text>{t(`permissions.${permission}`)}</Typography.Text>
          <Typography.Text type="secondary" code style={{ fontSize: token.fontSizeSM }}>
            {permission}
          </Typography.Text>
        </Flex>
      ),
    },
    ...ROLES.map((role) => ({
      title: (
        <Typography.Text strong={user?.role === role} type={user?.role === role ? undefined : "secondary"}>
          {t(`roles.${role}`)}
        </Typography.Text>
      ),
      key: role,
      align: "center" as const,
      onCell: () => ({ style: user?.role === role ? { background: token.colorPrimaryBg } : {} }),
      render: (_: unknown, { permission }: { permission: Permission }) =>
        can(SAMPLE_ACTOR_BY_ROLE[role], permission) ? (
          <Typography.Text type="success" aria-label="Permitido">
            <Check />
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary" aria-label="Denegado">
            <X />
          </Typography.Text>
        ),
    })),
  ];

  return (
    <DemoBlock
      id="permisos"
      title="Matriz de permisos"
      description="Generada en vivo desde lib/auth/permissions.ts: si cambiás la política, esta tabla se actualiza sola. La columna resaltada es tu rol."
      code={`
// src/lib/auth/permissions.ts
const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  admin: new Set(ALL_PERMISSIONS),
  adult: new Set(["inventory.view", "inventory.create", ...]),
  kid:   new Set(["inventory.view", "shopping.view"]),
};

can(user, "inventory.delete");   // boolean
assertCan(user, "inventory.delete"); // lanza PermissionError
`}
    >
      <Table
        rowKey="permission"
        size="small"
        columns={columns}
        dataSource={PERMISSIONS.map((permission) => ({ permission }))}
        pagination={false}
        scroll={{ x: true }}
      />
    </DemoBlock>
  );
}

function ServiceGuardBlock() {
  const t = useT();
  const user = useCurrentUser();
  const { message } = App.useApp();

  async function callServiceDirectly() {
    try {
      // Id inexistente: si el permiso pasa, Dexie no borra nada. Lo que importa es el chequeo.
      await deleteInventoryItem(user, "demo-inexistente");
      message.success("El servicio aceptó la operación: tu perfil tiene inventory.delete.");
    } catch (error) {
      message.error(getErrorMessage(error, t));
    }
  }

  return (
    <DemoBlock
      id="servicios"
      title="Defensa en profundidad: el servicio también verifica"
      description="Aunque un botón se escape del <Can>, el servicio corta la operación. Este botón NO está protegido en la UI: llama al servicio directamente. Probalo con distintos perfiles."
      code={`
// src/features/inventory/service.ts
export async function deleteInventoryItem(actor: Actor | null, id: string) {
  assertCan(actor, "inventory.delete"); // lanza PermissionError si no puede
  await db.inventory.delete(id);
}

// En la UI, vía hook: maneja errores y muestra el mensaje
const { remove } = useInventoryActions("alacena");
await remove(id);
`}
    >
      <Button danger onClick={callServiceDirectly}>
        Llamar a deleteInventoryItem() sin guardia de UI
      </Button>
    </DemoBlock>
  );
}

"use client";

import { Button, Checkbox, Flex, Input, Typography, theme } from "antd";
import { HardDrive, House, KeyRound, UserPlus } from "lucide-react";
import { useState } from "react";
import { Callout, ChoiceCards, ContextBadge, PanelHeader, ProviderButton, ResultState, SectionTitle, SettingRow, StepFlow, TrustNote } from "@/components/ui";
import { DemoBlock, DemoLabel } from "./DemoBlock";

type Path = "local" | "create" | "join";
const PATHS = [
  { value: "local" as const, title: "Este dispositivo", description: "Sin cuenta. La casa queda acá." },
  { value: "create" as const, title: "Crear casa compartida", description: "Primero el acceso a la beta. Después la cuenta." },
  { value: "join" as const, title: "Unirme", description: "Abrí la invitación de alguien de tu casa." },
];
const STEPS = {
  local: ["Preparar casa", "Listo"],
  create: ["Acceso", "Cuenta", "Respaldo", "Preparar casa", "Nombre", "Listo"],
  join: ["Invitación", "Cuenta", "Respaldo", "Perfil", "Listo"],
};

export function EntrySection() {
  return <DemoBlock id="componentes-entrada" title="Entrada: PanelHeader, Callout, StepFlow, ResultState, TrustNote, SettingRow y ProviderButton"
    description="El panel conserva el ancho al cambiar de paso. Cada paso tiene un título, una acción principal y un regreso seguro. Los borradores pertenecen al flujo: volver no los borra. Los estados de carga bloquean el doble envío. El foco acompaña el cambio de paso."
    code={`<StepFlow steps={steps} current={current} screenKey={step}
  header={<PanelHeader icon={House} title={t("cloud.house.title")} />}
  primary={{ label: t("common.save"), onClick: save, loading: busy }}>
  <Callout tone="warning">{t("cloud.transfer.replaceText", { name })}</Callout>
  {form}
</StepFlow>`}>
    <Flex vertical gap={24}>
      <DemoLabel>ContextBadge: contexto en la cabecera, detalle al tocar. Escape cierra y devuelve el foco.</DemoLabel>
      <div><ContextBadge icon={House} label="Demo" title="Casa de ejemplo">
        <Typography.Text type="secondary">Tu copia es independiente. Los cambios quedan en este navegador.</Typography.Text>
        <Button>Acción de ejemplo</Button>
      </ContextBadge></div>
      <DemoLabel>SectionTitle: título editorial de portada, con eyebrow, escala adaptable y entrada al aparecer.</DemoLabel>
      <SectionTitle eyebrow="El proyecto" title="Una casa abierta" description="La misma firma visual en las secciones públicas." />
      <AccountPatterns />
      <PanelHeader icon={House} title="Prepará tu casa" description="Elegí los espacios que querés organizar." />
      <DemoLabel>Callout: una ayuda por decisión, con detalle adicional solo cuando hace falta</DemoLabel>
      <Callout title="En este dispositivo">Exportá un respaldo para conservar una copia.</Callout>
      <Callout tone="primary" title="Podés empezar sin precarga">Sumá los ambientes y productos cuando los necesites.</Callout>
      <Callout tone="warning" title="Este dispositivo ya tiene una casa">Guardá un respaldo antes de reemplazarla.</Callout>
      <Callout tone="danger" title="No se pudo guardar">Revisá la conexión y volvé a intentar. Tu borrador sigue acá.</Callout>
      <DemoLabel>TrustNote: el alcance exacto de la protección, sin repetir un bloque de alertas</DemoLabel>
      <TrustNote />
      <DemoLabel>ResultState: confirma qué se guardó y ofrece el siguiente paso</DemoLabel>
      <ResultState title="Tu casa está lista" description="La selección quedó guardada en este dispositivo." action={<Button type="primary">Entrar a mi casa</Button>} />
    </Flex>
  </DemoBlock>;
}

/** Referencia interactiva sin red ni escrituras: nunca crea cuentas ni modifica la casa abierta. */
export function EntryFlow() {
  const { token } = theme.useToken();
  const [path, setPath] = useState<Path>("local");
  const [current, setCurrent] = useState(0);
  const [name, setName] = useState("");
  const [houseName, setHouseName] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [invitation, setInvitation] = useState("");
  const [rooms, setRooms] = useState<string[]>([]);
  const [error, setError] = useState(false);
  const [failure, setFailure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedKit, setSavedKit] = useState(false);
  const steps = STEPS[path];
  const step = steps[current];
  const done = current === steps.length - 1;
  function next() {
    if ((step === "Nombre" && !houseName.trim()) || (step === "Respaldo" && !savedKit) || failure) { setError(true); return; }
    setError(false);
    setCurrent(current + 1);
  }
  return <DemoBlock id="flujo-entrada" title="Flujo: entrada"
    description="Patrones adoptados en los flujos de entrada. Probá los tres caminos, volvé un paso y simulá un error. Esta maqueta no crea cuentas, no valida licencias y no guarda datos. Los formularios de contraseña y recuperación mantienen sus validaciones reales en la app."
    code={`// El estado del formulario vive fuera del panel animado.
<StepFlow screenKey={step} steps={steps} current={current}
  header={<PanelHeader title={title} description={description} />}
  back={canGoBack ? { label: t("common.back"), onClick: back } : undefined}
  primary={{ label: submitLabel, onClick: submit, loading: busy }}>
  {children}
</StepFlow>`}>
    <Flex vertical gap={token.marginLG}>
      <ChoiceCards aria-label="Camino de entrada" value={path} options={PATHS} onChange={(value) => { setPath(value); setCurrent(0); setError(false); setBusy(false); setSavedKit(false); }} />
      <Callout title="Decisiones del flujo">
        En este dispositivo no se pide cuenta. Para compartir, se valida el acceso antes de crearla.
        Al unirse, se muestra quién invita y qué casa se va a abrir. Si ya hay datos locales, se confirma el reemplazo antes de descargar.
        Nunca se vuelve atrás una creación de cuenta ni una escritura ya confirmada.
      </Callout>
      <Flex wrap gap={token.margin}>
        <Checkbox checked={failure} onChange={(event) => { setFailure(event.target.checked); setError(false); }}>Simular error al continuar</Checkbox>
        <Checkbox checked={busy} onChange={(event) => setBusy(event.target.checked)}>Mostrar envío en curso</Checkbox>
      </Flex>
      <StepFlow steps={steps} current={current} screenKey={`${path}-${current}`} busy={busy}
        header={!done && <PanelHeader icon={path === "local" ? HardDrive : path === "create" ? House : UserPlus} title={step} description={path === "local" ? "Tu casa queda en este dispositivo." : "Tu casa se comparte cifrada."} />}
        back={!done && (current === 1 || (path === "create" && step === "Nombre")) ? { label: "Volver", onClick: () => { setCurrent(current - 1); setError(false); } } : undefined}
        primary={!done ? { label: step === "Preparar casa" && path === "local" ? "Guardar esta selección" : "Continuar", onClick: next } : undefined}>
        {done ? <ResultState title="Tu casa está lista" description={path === "local" ? "La selección quedó guardada en este dispositivo." : "Ya podés entrar con tu perfil."}
          action={<Button type="primary" onClick={() => { setCurrent(0); setError(false); }}>Volver a probar</Button>} /> : <>
          {step === "Acceso" && <><Callout icon={KeyRound} title="Beta por invitación">Necesitás un código de acceso para crear una casa compartida. Empezar en este dispositivo es gratis.</Callout><Input aria-label="Código de ejemplo" value={accessCode} onChange={(event) => setAccessCode(event.target.value)} disabled={busy} placeholder="OD-XXXX-XXXX-XXXX-XXXX" /></>}
          {step === "Invitación" && <><Input aria-label="Invitación de ejemplo" value={invitation} onChange={(event) => setInvitation(event.target.value)} disabled={busy} placeholder="Pegá el enlace que te compartieron" /><TrustNote>El enlace incluye una clave que se usa en tu dispositivo.</TrustNote></>}
          {step === "Cuenta" && <><PanelHeader title={path === "join" ? "Te invitan a Casa del patio" : "Creá tu cuenta"} description={path === "join" ? "Invita Marina · Perfil adulto. Si ya tenés cuenta, entrá con ella." : "Nombre, correo y contraseña con confirmación."} /><Input aria-label="Nombre de ejemplo" value={name} onChange={(event) => setName(event.target.value)} placeholder="Tu nombre" /><TrustNote /></>}
          {step === "Respaldo" && <><Callout tone="warning" icon={KeyRound} title="Guardá el kit de recuperación">Lo necesitás si olvidás la contraseña. No podemos recuperarla por vos.</Callout><Checkbox checked={savedKit} onChange={(event) => setSavedKit(event.target.checked)}>Ya guardé mi kit</Checkbox></>}
          {step === "Preparar casa" && <><Callout>Elegí ambientes y artículos de ejemplo. Revisá sus cantidades antes de guardar. También podés empezar sin precarga.</Callout><Checkbox.Group disabled={busy} value={rooms} onChange={setRooms} options={["Cocina", "Dormitorio", "Taller"]} /><Typography.Text type="secondary">La revisión final incluye contenedores, cantidades y calendario opcional. Se guarda toda la selección en un solo paso.</Typography.Text><Button disabled={busy} onClick={next}>Empezar sin precarga</Button></>}
          {step === "Nombre" && <Input aria-label="Nombre de la casa de ejemplo" value={houseName} onChange={(event) => setHouseName(event.target.value)} disabled={busy} placeholder="Casa del patio" />}
          {step === "Perfil" && <Callout title="Elegí tu perfil">Se ofrecen los perfiles disponibles compatibles con tu rol. Si no hay ninguno, se crea uno para vos.</Callout>}
          {error && <Callout tone="danger" role="alert" title={failure ? "No se pudo continuar" : step === "Respaldo" ? "Confirmá que guardaste el kit" : "Ingresá un nombre."}>{failure ? "Tu selección sigue acá. Desactivá el error de ejemplo y volvé a intentar." : undefined}</Callout>}
        </>}
      </StepFlow>
    </Flex>
  </DemoBlock>;
}


/** Simulación local: los proveedores de /design nunca abren OAuth ni modifican la cuenta. */
function AccountPatterns() {
  const [linked, setLinked] = useState(false);
  const [busy, setBusy] = useState(false);
  return <>
    <DemoLabel>SettingRow y ProviderButton: ajustes adaptables y marcas monocromas en SVG</DemoLabel>
    <SettingRow label="Acceso con proveedores" description="La contraseña de OpenDomus sigue abriendo tus datos cifrados." stacked>
      <Flex vertical gap={12}>
        <Checkbox checked={busy} onChange={event => setBusy(event.target.checked)}>Simular espera</Checkbox>
        <ProviderButton provider="google" loading={busy} disabled={busy}>Continuar con Google</ProviderButton>
        <ProviderButton provider="github" disabled={busy || linked} onClick={() => setLinked(true)}>{linked ? "GitHub vinculado" : "Vincular GitHub"}</ProviderButton>
        {linked && <Button onClick={() => setLinked(false)}>Reiniciar ejemplo</Button>}
      </Flex>
    </SettingRow>
    <SettingRow label="Estado" description="Los controles quedan debajo del texto cuando falta espacio." last>
      <Typography.Text type="secondary">Referencia sin conexión</Typography.Text>
    </SettingRow>
  </>;
}

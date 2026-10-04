import { Suspense } from "react";
import { ProjectView } from "@/features/projects/components/ProjectView";

// `/proyectos/ver?id=…`: página fija que lee el id en el cliente (ver /recetas/ver).
export default function ProjectRoute() {
  return (
    <Suspense fallback={null}>
      <ProjectView />
    </Suspense>
  );
}

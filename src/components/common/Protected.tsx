"use client";

import { useAppStore, Role } from "@/store/useAppStore";
import { Tooltip } from "antd";
import React from "react";

interface ProtectedProps {
  children: React.ReactNode;
  allowedRoles: Role[];
  /**
   * ¿Qué hacer si no tiene permisos?
   * "hide": Destruye el componente (ni siquiera se renderiza en el DOM).
   * "disable": Lo renderiza pero bloqueado, opaco y con un tooltip explicativo.
   */
  fallback?: "hide" | "disable";
  tooltipMessage?: string;
}

export function Protected({ 
  children, 
  allowedRoles, 
  fallback = "hide",
  tooltipMessage = "Permiso denegado"
}: ProtectedProps) {
  const { currentUser } = useAppStore();
  const role = currentUser?.role || 'kid'; // Default al privilegio más bajo
  
  const hasAccess = allowedRoles.includes(role);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallback === "hide") {
    return null;
  }

  // Fallback "disable": Clonamos el elemento hijo para inyectarle prop disabled y anular punteros
  return (
    <Tooltip title={tooltipMessage}>
      <span style={{ display: 'inline-block', cursor: 'not-allowed', opacity: 0.6 }}>
        {React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child as React.ReactElement<any>, { 
              disabled: true, 
              style: { ...(child.props.style || {}), pointerEvents: 'none' } 
            });
          }
          return child;
        })}
      </span>
    </Tooltip>
  );
}

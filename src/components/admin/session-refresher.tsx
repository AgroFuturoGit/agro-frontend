"use client";

import { useEffect } from "react";

import { refreshSessionFromServer } from "@/lib/auth";

/** Regrava a sessão local (papel e usuário) com o `GET /auth/me` ao montar o painel. */
export function SessionRefresher() {
  useEffect(() => {
    void refreshSessionFromServer();
  }, []);
  return null;
}

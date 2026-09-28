"use client";

import { createContext, useContext } from "react";

/** Set by the focus room: `paused` is true while the user is outside fullscreen. */
export const FocusContext = createContext<{ inFocus: boolean; paused: boolean }>({ inFocus: false, paused: false });

export const useFocus = () => useContext(FocusContext);

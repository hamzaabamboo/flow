/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Server URL - Your HamFlow instance URL */
  "serverUrl": string,
  /** API Token - Your HamFlow API token from Settings */
  "apiToken": string,
  /** Default Space - Default space for new tasks */
  "defaultSpace": "work" | "personal"
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `ai-command` command */
  export type AiCommand = ExtensionPreferences & {}
  /** Preferences accessible in the `view-agenda` command */
  export type ViewAgenda = ExtensionPreferences & {}
  /** Preferences accessible in the `quick-add` command */
  export type QuickAdd = ExtensionPreferences & {}
  /** Preferences accessible in the `view-tasks` command */
  export type ViewTasks = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `ai-command` command */
  export type AiCommand = {
  /** e.g., deploy staging tomorrow */
  "command": string
}
  /** Arguments passed to the `view-agenda` command */
  export type ViewAgenda = {}
  /** Arguments passed to the `quick-add` command */
  export type QuickAdd = {
  /** Task title */
  "title": string
}
  /** Arguments passed to the `view-tasks` command */
  export type ViewTasks = {}
}


import { Mastra } from '@mastra/core';
import { commandProcessor } from './agents/commandProcessor';

export const mastra = new Mastra({
  agents: {
    commandProcessor
  },
  telemetry: {
    enabled: false
  }
});

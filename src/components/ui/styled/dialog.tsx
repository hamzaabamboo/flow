'use client';
import type { Assign } from '@ark-ui/react';
import {
  DialogRootProvider,
  DialogRoot,
  DialogBackdrop,
  DialogCloseTrigger,
  DialogContent,
  DialogDescription,
  DialogPositioner,
  DialogTitle,
  DialogTrigger,
  DialogContext,
  useDialogContext,
} from '@ark-ui/react/dialog';
import type {
  DialogRootProviderProps as ArkDialogRootProviderProps,
  DialogRootProps as ArkDialogRootProps,
  DialogBackdropBaseProps,
  DialogCloseTriggerBaseProps,
  DialogContentBaseProps,
  DialogDescriptionBaseProps,
  DialogPositionerBaseProps,
  DialogTitleBaseProps,
  DialogTriggerBaseProps,
} from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import { type DialogVariantProps, dialog } from 'styled-system/recipes';
import type { ComponentProps, HTMLStyledProps } from 'styled-system/types';
import { createStyleContext } from './utils/create-style-context';

const { withRootProvider, withContext } = createStyleContext(dialog);

export const RootProvider = withRootProvider<Assign<ArkDialogRootProviderProps, DialogVariantProps>>(
  DialogRootProvider
);
export type RootProviderProps = ComponentProps<typeof RootProvider>;

export const Root = withRootProvider<Assign<ArkDialogRootProps, DialogVariantProps>>(DialogRoot);
export type RootProps = ComponentProps<typeof Root>;

export const Backdrop = withContext<
  HTMLDivElement,
  Assign<HTMLStyledProps<'div'>, DialogBackdropBaseProps>
>(DialogBackdrop, 'backdrop');

export const CloseTrigger = withContext<
  HTMLButtonElement,
  Assign<HTMLStyledProps<'button'>, DialogCloseTriggerBaseProps>
>(DialogCloseTrigger, 'closeTrigger');

export const Content = withContext<
  HTMLDivElement,
  Assign<HTMLStyledProps<'div'>, DialogContentBaseProps>
>(DialogContent, 'content');

export const Description = withContext<
  HTMLDivElement,
  Assign<HTMLStyledProps<'div'>, DialogDescriptionBaseProps>
>(DialogDescription, 'description');

export const Positioner = withContext<
  HTMLDivElement,
  Assign<HTMLStyledProps<'div'>, DialogPositionerBaseProps>
>(DialogPositioner, 'positioner');

export const Title = withContext<
  HTMLHeadingElement,
  Assign<HTMLStyledProps<'h2'>, DialogTitleBaseProps>
>(DialogTitle, 'title');

export const Trigger = withContext<
  HTMLButtonElement,
  Assign<HTMLStyledProps<'button'>, DialogTriggerBaseProps>
>(DialogTrigger, 'trigger');

export { DialogContext as Context, useDialogContext };
export { Portal };

'use client';
import type { Assign } from '@ark-ui/react';
import {
  AvatarRoot,
  AvatarFallback,
  AvatarImage,
  AvatarContext,
} from '@ark-ui/react/avatar';
import type {
  AvatarRootBaseProps,
  AvatarFallbackBaseProps,
  AvatarImageBaseProps,
  AvatarStatusChangeDetails,
} from '@ark-ui/react/avatar';
import { type AvatarVariantProps, avatar } from 'styled-system/recipes';
import type { ComponentProps, HTMLStyledProps } from 'styled-system/types';
import { createStyleContext } from './utils/create-style-context';

const { withProvider, withContext } = createStyleContext(avatar);

export const Root = withProvider<
  HTMLDivElement,
  Assign<Assign<HTMLStyledProps<'div'>, AvatarRootBaseProps>, AvatarVariantProps>
>(AvatarRoot, 'root');
export type RootProps = ComponentProps<typeof Root>;

export const Fallback = withContext<
  HTMLSpanElement,
  Assign<HTMLStyledProps<'span'>, AvatarFallbackBaseProps>
>(AvatarFallback, 'fallback');

export const Image = withContext<
  HTMLImageElement,
  Assign<HTMLStyledProps<'img'>, AvatarImageBaseProps>
>(AvatarImage, 'image');

export { AvatarContext as Context };
export type { AvatarStatusChangeDetails as StatusChangeDetails };

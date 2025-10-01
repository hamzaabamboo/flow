import React from 'react';
import { cva } from 'styled-system/css';
import { Box, styled } from 'styled-system/jsx';

const spinnerRecipe = cva({
  base: {
    display: 'inline-block',
    borderRadius: 'full',
    borderWidth: '2px',
    borderStyle: 'solid',
    animation: 'spin 0.6s linear infinite'
  },
  variants: {
    size: {
      sm: {
        borderWidth: '2px',
        width: '4',
        height: '4'
      },
      md: {
        borderWidth: '3px',
        width: '8',
        height: '8'
      },
      lg: {
        borderWidth: '4px',
        width: '12',
        height: '12'
      }
    },
    colorScheme: {
      primary: {
        borderColor: 'transparent',
        borderRightColor: 'colorPalette.default',
        borderTopColor: 'colorPalette.default'
      },
      secondary: {
        borderColor: 'transparent',
        borderRightColor: 'gray.default',
        borderTopColor: 'gray.default'
      },
      white: {
        borderColor: 'transparent',
        borderRightColor: 'fg.default',
        borderTopColor: 'fg.default'
      }
    }
  },
  defaultVariants: {
    size: 'md',
    colorScheme: 'primary'
  }
});

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  colorScheme?: 'primary' | 'secondary' | 'white';
  fullScreen?: boolean;
  text?: string;
}

export function Loading({ size = 'md', colorScheme = 'primary', fullScreen, text }: LoadingProps) {
  const spinner = (
    <>
      <Box className={spinnerRecipe({ size, colorScheme })} />
      {text && (
        <styled.span mt="2" color="fg.muted" fontSize="sm">
          {text}
        </styled.span>
      )}
    </>
  );

  if (fullScreen) {
    return (
      <Box
        display="flex"
        zIndex="50"
        inset="0"
        position="fixed"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        bg="bg.default/80"
        backdropFilter="blur(4px)"
      >
        {spinner}
      </Box>
    );
  }

  return (
    <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" p="4">
      {spinner}
    </Box>
  );
}

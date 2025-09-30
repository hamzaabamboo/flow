import type { ErrorInfo } from 'react';
import React from 'react';
import { RotateCcw, Copy, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Code } from '../ui/code';
import { Text } from '../ui/text';
import { Heading } from '../ui/heading';
import { Center, Stack, HStack } from 'styled-system/jsx';

interface ErrorBoundaryState {
  error?: Error;
  info?: ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {};
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ error, info });
    console.error('ErrorBoundary caught an error:', error, info);
  }

  copyMessage = () => {
    const msg = this.state.error?.stack;
    if (msg) {
      void navigator.clipboard.writeText(msg);
    }
  };

  render() {
    if (this.state.error) {
      return (
        <Center w="100vw" minH="100dvh" px="4">
          <Stack gap="6" alignItems="center" maxW="800px">
            <Heading size="2xl">Something went wrong</Heading>
            <Text textAlign="center">
              An unexpected error occurred. You can try refreshing the page or clearing your browser
              data.
            </Text>
            <Code maxW="full" p="4" overflow="auto" whiteSpace="pre-wrap">
              {this.state.error.stack}
            </Code>
            <HStack gap="3">
              <Button variant="ghost" onClick={this.copyMessage}>
                <Copy width="16" height="16" />
                Copy Error
              </Button>
              <Button onClick={() => window.location.reload()}>
                <RotateCcw width="16" height="16" />
                Reload Page
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  localStorage.clear();
                  sessionStorage.clear();
                  navigator.serviceWorker.getRegistrations().then((registrations) => {
                    for (const registration of registrations) {
                      void registration.unregister();
                    }
                  });
                  window.location.reload();
                }}
              >
                <Trash2 width="16" height="16" />
                Clear & Reload
              </Button>
            </HStack>
          </Stack>
        </Center>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

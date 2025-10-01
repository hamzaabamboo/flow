import React from 'react';
import { Button } from '../../components/ui/button';
import * as Card from '../../components/ui/styled/card';
import { VStack, Box } from 'styled-system/jsx';

export default function LoginPage() {
  const handleOAuthLogin = () => {
    const returnUrl = new URLSearchParams(window.location.search).get('returnUrl') || '/';
    window.location.href = `/api/auth/login?returnUrl=${encodeURIComponent(returnUrl)}`;
  };

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      bg="bg.subtle"
    >
      <Card.Root width="100%" maxWidth="400px">
        <Card.Header>
          <Card.Title textAlign="center">Welcome to HamFlow</Card.Title>
          <Box color="fg.muted" fontSize="sm" textAlign="center" mt="2">
            Sign in to continue
          </Box>
        </Card.Header>
        <Card.Body>
          <VStack gap="3">
            <Button onClick={handleOAuthLogin} variant="solid" width="100%" size="lg">
              Sign in
            </Button>
            <Box color="fg.muted" fontSize="xs" textAlign="center">
              Secure OAuth authentication
            </Box>
          </VStack>
        </Card.Body>
      </Card.Root>
    </Box>
  );
}

import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import * as Card from '../../components/ui/styled/card';
import { VStack, Box } from 'styled-system/jsx';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSetup, setIsSetup] = useState(false);
  const [name, setName] = useState('');

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      return response.json();
    },
    onSuccess: () => {
      window.location.href = '/';
    }
  });

  // Auto-login mutation
  const autoLoginMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/auth/auto-login', {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Auto-login failed');
      }

      return response.json();
    },
    onSuccess: () => {
      window.location.href = '/';
    }
  });

  // Setup mutation
  const setupMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Setup failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      alert(`User created! Save this to your .env file:\nUSER_PASSWORD_HASH=${data.passwordHash}`);
      setIsSetup(false);
      // Auto-login after setup
      loginMutation.mutate();
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSetup) {
      setupMutation.mutate();
    } else {
      loginMutation.mutate();
    }
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
          <Card.Title textAlign="center">
            {isSetup ? 'Setup HamFlow' : 'Welcome to HamFlow'}
          </Card.Title>
        </Card.Header>
        <Card.Body>
          {!isSetup && (
            <VStack gap="4" mb="4">
              <Button
                onClick={() => autoLoginMutation.mutate()}
                disabled={autoLoginMutation.isPending}
                variant="solid"
                colorPalette="accent"
                width="100%"
              >
                {autoLoginMutation.isPending ? 'Loading...' : 'Quick Login (Single User)'}
              </Button>

              <Box color="fg.muted" fontSize="sm" textAlign="center">
                — OR —
              </Box>
            </VStack>
          )}

          <form onSubmit={handleSubmit}>
            <VStack gap="4">
              {isSetup && (
                <Box width="100%">
                  <label
                    htmlFor="name-input"
                    style={{
                      display: 'block',
                      marginBottom: '4px',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    Name
                  </label>
                  <Input
                    id="name-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </Box>
              )}

              <Box width="100%">
                <label
                  htmlFor="email-input"
                  style={{
                    display: 'block',
                    marginBottom: '4px',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Email
                </label>
                <Input
                  id="email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="your@email.com"
                />
              </Box>

              <Box width="100%">
                <label
                  htmlFor="password-input"
                  style={{
                    display: 'block',
                    marginBottom: '4px',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  Password
                </label>
                <Input
                  id="password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                />
              </Box>

              <Button
                type="submit"
                disabled={loginMutation.isPending || setupMutation.isPending}
                variant="solid"
                width="100%"
              >
                {isSetup
                  ? setupMutation.isPending
                    ? 'Creating...'
                    : 'Create User'
                  : loginMutation.isPending
                    ? 'Logging in...'
                    : 'Login'}
              </Button>
            </VStack>
          </form>

          {(loginMutation.isError || setupMutation.isError || autoLoginMutation.isError) && (
            <Box colorPalette="red" mt="4" color="colorPalette.fg" fontSize="sm" textAlign="center">
              {loginMutation.error?.message ||
                setupMutation.error?.message ||
                autoLoginMutation.error?.message}
            </Box>
          )}

          {!isSetup && (
            <Box mt="4" color="fg.muted" fontSize="sm" textAlign="center">
              First time?
              <Button onClick={() => setIsSetup(true)} variant="link" ml="1">
                Setup account
              </Button>
            </Box>
          )}

          {isSetup && (
            <Box mt="4" textAlign="center">
              <Button onClick={() => setIsSetup(false)} variant="link">
                Back to login
              </Button>
            </Box>
          )}
        </Card.Body>
      </Card.Root>
    </Box>
  );
}

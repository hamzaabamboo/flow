export { Page };

import React from 'react';
import { usePageContext } from 'vike-react/usePageContext';
import { Home, RefreshCw, ChevronLeft, Search, ServerCrash, ShieldOff } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Text } from '../../components/ui/text';
import { Box, VStack, HStack, Center } from 'styled-system/jsx';

function Page() {
  const pageContext = usePageContext();

  // Determine error type and message
  const is404 = pageContext.is404 || pageContext.abortStatusCode === 404;
  const statusCode = pageContext.abortStatusCode || (is404 ? 404 : 500);
  const errorReason = pageContext.abortReason || pageContext.errorWhileRendering;

  // Get appropriate error message and title
  const getErrorContent = () => {
    if (is404) {
      return {
        title: '404',
        subtitle: 'Page Not Found',
        message: 'Oops! Looks like this page took a wrong turn at the kanban board.',
        icon: <Search width="64" height="64" />,
        color: 'blue'
      };
    }

    if (statusCode === 403) {
      return {
        title: '403',
        subtitle: 'Access Denied',
        message: "You don't have permission to access this resource.",
        icon: <ShieldOff width="64" height="64" />,
        color: 'orange'
      };
    }

    if (statusCode === 401) {
      return {
        title: '401',
        subtitle: 'Authentication Required',
        message: 'Please log in to access this page.',
        icon: <ShieldOff width="64" height="64" />,
        color: 'yellow'
      };
    }

    // Default 500 error
    return {
      title: '500',
      subtitle: 'Something Went Wrong',
      message:
        errorReason?.toString() || 'Our servers are having a moment. Please try again later.',
      icon: <ServerCrash width="64" height="64" />,
      color: 'red'
    };
  };

  const { title, subtitle, message, icon, color } = getErrorContent();

  const handleGoBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  const handleRefresh = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  return (
    <Center minH="100vh" p="6" bg="bg.subtle">
      <VStack gap="8" maxW="md" textAlign="center">
        {/* Error Icon */}
        <Box
          colorPalette={color}
          color="colorPalette.default"
          animation="pulse 2s ease-in-out infinite"
          opacity="0.8"
        >
          {icon}
        </Box>

        {/* Error Title */}
        <VStack gap="2">
          <Text
            color="fg.default"
            fontSize={{ base: '4xl', md: '6xl' }}
            fontWeight="bold"
            letterSpacing="tight"
          >
            {title}
          </Text>
          <Text color="fg.muted" fontSize={{ base: 'lg', md: '2xl' }} fontWeight="medium">
            {subtitle}
          </Text>
        </VStack>

        <Text maxW="sm" color="fg.muted" fontSize="lg">
          {message}
        </Text>

        {/* Action Buttons */}
        <HStack gap="4" justifyContent="center" flexWrap="wrap">
          {!is404 && (
            <Button onClick={handleRefresh} variant="outline" size="lg" gap="2">
              <RefreshCw width="20" height="20" />
              Try Again
            </Button>
          )}

          <Button onClick={handleGoBack} variant="outline" size="lg" gap="2">
            <ChevronLeft width="20" height="20" />
            Go Back
          </Button>

          <Button onClick={handleGoHome} variant="solid" size="lg" gap="2">
            <Home width="20" height="20" />
            Go Home
          </Button>
        </HStack>

        {/* Debug Information (only in development) */}
        {process.env.NODE_ENV === 'development' && errorReason && (
          <Box
            borderColor="border.default"
            borderRadius="md"
            borderWidth="1px"
            w="full"
            maxW="2xl"
            mt="8"
            p="4"
            bg="bg.muted"
          >
            <Text mb="2" color="fg.muted" fontSize="sm" fontWeight="medium">
              Debug Information:
            </Text>
            <Text
              color="fg.subtle"
              fontFamily="mono"
              fontSize="xs"
              textAlign="left"
              whiteSpace="pre-wrap"
            >
              {typeof errorReason === 'object'
                ? JSON.stringify(errorReason, null, 2)
                : String(errorReason as string)}
            </Text>
          </Box>
        )}
      </VStack>
    </Center>
  );
}

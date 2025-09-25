import type { KeyboardEvent } from 'react';
import React, { useState, useRef } from 'react';
import { useSpace } from '../../contexts/SpaceContext';
import { Input } from '../ui/input';
import { IconButton } from '../ui/icon-button';
import { Text } from '../ui/text';
import { HStack } from 'styled-system/jsx';

export function CommandBar() {
  const [command, setCommand] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { currentSpace } = useSpace();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Voice input is not supported in your browser');
      return;
    }

    interface ISpeechRecognitionConstructor {
      new (): SpeechRecognition;
    }

    interface IWindow extends Window {
      webkitSpeechRecognition?: ISpeechRecognitionConstructor;
      SpeechRecognition?: ISpeechRecognitionConstructor;
    }

    const SpeechRecognitionConstructor =
      (window as IWindow).webkitSpeechRecognition || (window as IWindow).SpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      return;
    }

    const recognition = new SpeechRecognitionConstructor();

    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: Event) => {
      const speechEvent = event as SpeechRecognitionEvent;
      const transcript = speechEvent.results[0][0].transcript;
      setCommand(transcript);
      setIsListening(false);
      processCommand(transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
      alert('Voice input failed. Please try again.');
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const processCommand = async (cmd: string) => {
    if (!cmd.trim()) return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: cmd,
          space: currentSpace
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Command processed:', result);
        // TODO: Handle different command results
        setCommand('');
      }
    } catch (error) {
      console.error('Command processing failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      processCommand(command);
    }
  };

  return (
    <HStack
      gap="2"
      borderColor="border.default"
      borderRadius="md"
      borderWidth="1px"
      p="2"
      bg="bg.default"
      boxShadow="sm"
    >
      <Input
        ref={inputRef}
        type="text"
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a command or click the mic..."
        disabled={isListening || isProcessing}
        flex="1"
        border="none"
        _focus={{ outline: 'none' }}
      />

      <IconButton
        onClick={() => void handleVoiceInput()}
        disabled={isListening || isProcessing}
        variant={isListening ? 'solid' : 'outline'}
        aria-label="Voice input"
        colorPalette={isListening ? 'red' : undefined}
      >
        {isListening ? '🔴' : '🎤'}
      </IconButton>

      {isProcessing && (
        <Text color="fg.muted" fontSize="sm">
          Processing...
        </Text>
      )}
    </HStack>
  );
}

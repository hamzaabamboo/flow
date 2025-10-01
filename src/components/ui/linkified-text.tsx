import { Text } from './text';
import { Link } from './link';
import type { TextProps } from './text';

interface LinkifiedTextProps extends TextProps {
  children: string;
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

export function LinkifiedText({ children, ...textProps }: LinkifiedTextProps) {
  const parts = children.split(URL_REGEX);

  return (
    <Text {...textProps}>
      {parts.map((part, index) => {
        if (part.match(URL_REGEX)) {
          return (
            <Link
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              color="colorPalette.default"
              textDecoration="underline"
              _hover={{ color: 'colorPalette.emphasized' }}
            >
              {part}
            </Link>
          );
        }
        return part;
      })}
    </Text>
  );
}

import type { Config } from 'vike/types';
import vikeReact from 'vike-react/config';

export default {
  extends: vikeReact,
  title: 'HamFlow',
  description: 'Your personalized productivity hub',
  passToClient: ['user', 'space']
} satisfies Config;

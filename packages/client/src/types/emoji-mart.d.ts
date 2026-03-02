/** emoji-mart 及相关包的类型声明 */
declare module 'emoji-mart' {
  export class Picker {
    constructor(options: {
      data: unknown;
      onEmojiSelect: (emoji: { native: string; id: string }) => void;
      locale?: string;
      theme?: 'light' | 'dark' | 'auto';
      previewPosition?: 'none' | 'top' | 'bottom';
      skinTonePosition?: 'none' | 'search' | 'preview';
    });
  }
}

declare module '@emoji-mart/data' {
  const data: unknown;
  export default data;
}

declare module '@emoji-mart/react' {
  import type { FC } from 'react';
  interface PickerProps {
    data: unknown;
    onEmojiSelect: (emoji: { native: string; id: string }) => void;
    locale?: string;
    theme?: 'light' | 'dark' | 'auto';
    previewPosition?: 'none' | 'top' | 'bottom';
    skinTonePosition?: 'none' | 'search' | 'preview';
  }
  const Picker: FC<PickerProps>;
  export default Picker;
}

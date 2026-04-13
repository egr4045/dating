// Mock for telegraf (ESM-only package — not compatible with Jest's CJS transform)
export const Telegraf = jest.fn().mockImplementation(() => ({
  start: jest.fn(),
  command: jest.fn(),
  on: jest.fn(),
  launch: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn(),
  telegram: {
    sendMessage: jest.fn().mockResolvedValue({}),
  },
}));

export const Markup = {
  button: {
    callback: jest.fn((text: string, data: string) => ({ text, callback_data: data })),
    webApp: jest.fn((text: string, url: string) => ({ text, web_app: { url } })),
    url: jest.fn((text: string, url: string) => ({ text, url })),
  },
  inlineKeyboard: jest.fn((buttons: any) => ({
    reply_markup: { inline_keyboard: buttons },
  })),
  keyboard: jest.fn((buttons: any) => ({
    reply_markup: { keyboard: buttons },
  })),
};

export default Telegraf;

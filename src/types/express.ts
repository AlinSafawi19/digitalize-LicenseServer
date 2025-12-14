// Type augmentation for Express Request to include admin
/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      admin?: {
        id: number;
        username: string;
        phone: string;
      };
    }
  }
}

export {};


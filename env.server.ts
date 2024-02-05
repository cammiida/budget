import { z } from "zod";

export const envSchema = z.object({
  /**
   * The secret used to sign session cookies.
   */
  SESSION_SECRET: z.string(),

  /**
   * Client ID and secret for Google OAuth.
   */
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),

  /*
   * GoCardless API
   */
  GO_CARDLESS_API_KEY: z.string(),
  GO_CARDLESS_SECRET_ID: z.string(),
  GO_CARDLESS_SECRET_KEY: z.string(),
});

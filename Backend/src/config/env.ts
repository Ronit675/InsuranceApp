import 'dotenv/config';

const readEnv = (name: string) => {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
};

export const getRequiredEnv = (name: string) => {
  const value = readEnv(name);
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Add it to Backend/.env or export it before starting the backend.`,
    );
  }

  return value;
};

export const getOptionalEnv = (name: string) => readEnv(name);

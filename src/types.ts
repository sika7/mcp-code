
export type Config = {
  debug?: boolean;
  log_path?: string;
  excluded_files?: string[];
  rate_limit?: number;
  projects?: Record<
    string,
    {
      rate_limit?: number;
      src: string;
      scripts?: Record<string, string>;
      excluded_files?: string[];
    }
  >;
};

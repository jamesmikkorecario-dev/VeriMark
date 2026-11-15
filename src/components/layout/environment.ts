import { createContext, useContext } from 'react';

/** Which backend the app is talking to. Defaults to the demonstration so isolated renders stay labelled as fictional. */
export type Environment = 'demo' | 'supabase';
export const EnvironmentContext = createContext<Environment>('demo');
export const useEnvironment = () => useContext(EnvironmentContext);

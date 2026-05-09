import { createContext, useContext, useState, ReactNode } from "react";

interface AuthModalContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const AuthModalContext = createContext<AuthModalContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export function useAuthModal(): AuthModalContextType {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used within an AuthModalProvider");
  return ctx;
}

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <AuthModalContext.Provider value={{ isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) }}>
      {children}
    </AuthModalContext.Provider>
  );
}

import React, { createContext, useContext, useState, useEffect } from "react";
import { userAPI } from "./services/api";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("userData");
    if (stored) setUser(JSON.parse(stored));

    const token = localStorage.getItem("token");
    if (token) {
      userAPI.getMe().then(data => {
        if (data && data.user) {
          setUser(data.user);
          localStorage.setItem("userData", JSON.stringify(data.user));
        }
      });
    }
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem("userData", JSON.stringify(user));
    } else {
      localStorage.removeItem("userData");
    }
  }, [user]);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext); 
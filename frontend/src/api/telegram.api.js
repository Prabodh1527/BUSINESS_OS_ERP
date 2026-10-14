import API from "@/api/axios";

export const getTelegramStatus = async () => {
  const res = await API.get("/telegram/status");
  return res.data;
};

export const testTelegramToken = async (botToken) => {
  const res = await API.post("/telegram/test", { botToken });
  return res.data;
};

export const connectTelegramBot = async (botToken) => {
  const res = await API.post("/telegram/connect", { botToken });
  return res.data;
};

export const disconnectTelegramBot = async () => {
  const res = await API.post("/telegram/disconnect");
  return res.data;
};

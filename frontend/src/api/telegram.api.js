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

export const getTelegramPreferences = async () => {
  const res = await API.get("/telegram/preferences");
  return res.data;
};

export const updateTelegramPreferences = async (preferencesData) => {
  const res = await API.put("/telegram/preferences", preferencesData);
  return res.data;
};

export const generateTelegramLinkToken = async () => {
  const res = await API.post("/telegram/link-token");
  return res.data;
};

export const getTelegramAccountStatus = async () => {
  const res = await API.get("/telegram/account");
  return res.data;
};

export const unlinkTelegramAccount = async () => {
  const res = await API.post("/telegram/unlink");
  return res.data;
};

export const getTelegramLogs = async () => {
  const res = await API.get("/telegram/logs");
  return res.data;
};

export const sendDailySummaryNow = async () => {
  const res = await API.post("/telegram/send-summary-now");
  return res.data;
};

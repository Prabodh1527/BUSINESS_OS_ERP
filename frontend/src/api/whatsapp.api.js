import API from "@/api/axios";

export const getWhatsAppStatus = async () => {
  const res = await API.get("/whatsapp/status");
  return res.data;
};

export const testWhatsAppCredentials = async ({ phoneNumberId, accessToken }) => {
  const res = await API.post("/whatsapp/test", { phoneNumberId, accessToken });
  return res.data;
};

export const connectWhatsApp = async ({ phoneNumberId, accessToken, businessPhoneNumber, businessAccountId }) => {
  const res = await API.post("/whatsapp/connect", {
    phoneNumberId,
    accessToken,
    businessPhoneNumber,
    businessAccountId,
  });
  return res.data;
};

export const disconnectWhatsApp = async () => {
  const res = await API.post("/whatsapp/disconnect");
  return res.data;
};

export const updateWhatsAppPreferences = async (notificationPreferences) => {
  const res = await API.put("/whatsapp/preferences", { notificationPreferences });
  return res.data;
};

export const sendWhatsAppTestMessage = async ({ recipientPhone, message }) => {
  const res = await API.post("/whatsapp/send-test", { recipientPhone, message });
  return res.data;
};

export const getWhatsAppShareLink = async ({ type, id, phone }) => {
  const res = await API.get("/whatsapp/share-link", {
    params: { type, id, phone },
  });
  return res.data;
};

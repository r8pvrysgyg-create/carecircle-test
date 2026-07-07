import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

import { auth, db } from "./firebase.js";

const TEMPLATE_COLLECTION = "appointmentTemplates";

export async function createAppointmentTemplate(templateData) {
  const user = auth.currentUser;

  if (!user) {
    alert("You must be logged in to create templates.");
    return null;
  }

  const cleanTemplate = normalizeTemplate(templateData);

  if (!cleanTemplate.name) {
    alert("Template name is required.");
    return null;
  }

  const docRef = await addDoc(collection(db, TEMPLATE_COLLECTION), {
    ...cleanTemplate,
    favorite: cleanTemplate.favorite || false,
    lastUsedAt: null,
    createdBy: user.email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return docRef.id;
}

export async function updateAppointmentTemplate(templateId, templateData) {
  const user = auth.currentUser;

  if (!user) {
    alert("You must be logged in to update templates.");
    return;
  }

  const cleanTemplate = normalizeTemplate(templateData);

  await updateDoc(doc(db, TEMPLATE_COLLECTION, templateId), {
    ...cleanTemplate,
    updatedBy: user.email,
    updatedAt: serverTimestamp()
  });
}

export async function deleteAppointmentTemplate(templateId) {
  const user = auth.currentUser;

  if (!user) {
    alert("You must be logged in to delete templates.");
    return;
  }

  await deleteDoc(doc(db, TEMPLATE_COLLECTION, templateId));
}

export async function markTemplateUsed(templateId) {
  if (!templateId) return;

  await updateDoc(doc(db, TEMPLATE_COLLECTION, templateId), {
    lastUsedAt: serverTimestamp()
  });
}

export async function loadAppointmentTemplates() {
  const snapshot = await getDocs(collection(db, TEMPLATE_COLLECTION));
  const templates = [];

  snapshot.forEach(docSnap => {
    templates.push({
      id: docSnap.id,
      ...docSnap.data()
    });
  });

  return sortTemplates(templates);
}

export function getFavoriteTemplates(templates) {
  return sortTemplates(templates.filter(template => template.favorite === true));
}

export function getRecentTemplates(templates) {
  return [...templates]
    .filter(template => template.lastUsedAt)
    .sort((a, b) => {
      const aTime = a.lastUsedAt?.seconds || 0;
      const bTime = b.lastUsedAt?.seconds || 0;
      return bTime - aTime;
    })
    .slice(0, 5);
}

export function sortTemplates(templates) {
  return [...templates].sort((a, b) => {
    if (a.favorite !== b.favorite) {
      return a.favorite ? -1 : 1;
    }

    return (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase());
  });
}

export function normalizeTemplate(data) {
  return {
    name: (data.name || "").trim(),
    person: (data.person || "").trim(),
    appointmentType: (data.appointmentType || "").trim(),
    directoryContactId: data.directoryContactId || "",
    doctor: (data.doctor || "").trim(),
    location: (data.location || "").trim(),
    preferredDriver: data.preferredDriver || "",
    appointmentLengthMinutes: Number(data.appointmentLengthMinutes || 60),
    maplePickupOffsetMinutes: Number(data.maplePickupOffsetMinutes || 45),
    returnPickupOffsetMinutes: Number(data.returnPickupOffsetMinutes || 30),
    transportationNotes: (data.transportationNotes || "").trim(),
    notes: (data.notes || "").trim(),
    favorite: data.favorite === true
  };
}

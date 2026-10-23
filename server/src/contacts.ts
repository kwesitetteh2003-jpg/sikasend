import { parseGhanaPhone, type MomoNetwork } from './phone.js';

export interface Contact {
  id: string;
  name: string;
  relation: string;
  city: string;
  phone: string; // display
  msisdn: string;
  network: MomoNetwork;
  /** Transfers already made to this person (seeded demo history); 0 = first-time recipient. */
  priorTransfers: number;
  color: string;
}

/** Demo address book. All numbers are fictional test numbers. */
const raw = [
  { id: 'akosua', name: 'Auntie Akosua', relation: 'Aunt', city: 'Kumasi', phone: '0244123456', priorTransfers: 14, color: '#f5b83d' },
  { id: 'kofi', name: 'Kofi Mensah', relation: 'Brother', city: 'Tamale', phone: '0201234567', priorTransfers: 0, color: '#2fd47f' },
  { id: 'abena', name: 'Abena Owusu', relation: 'Landlady', city: 'Accra', phone: '0551234567', priorTransfers: 6, color: '#7aa2ff' },
];

export const CONTACTS: Contact[] = raw.map((c) => {
  const p = parseGhanaPhone(c.phone);
  if (!p.ok) throw new Error(`bad seed phone ${c.phone}`);
  return { ...c, phone: p.display!, msisdn: p.msisdn!, network: p.network! };
});

export const SENDER = { id: 'efua', name: 'Efua Boateng', city: 'Manchester, UK' };

export const findContact = (id: string) => CONTACTS.find((c) => c.id === id);
export const findContactByName = (text: string) => {
  const t = text.toLowerCase();
  return CONTACTS.find((c) => c.name.toLowerCase().split(' ').some((w) => w.length > 3 && t.includes(w)) || t.includes(c.relation.toLowerCase()));
};

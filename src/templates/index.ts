import type { PaperSizeName, Orientation } from '@/store/designStore'
import type { NumberingConfig } from '@/lib/numbering'

export interface TemplateElement {
  type: 'text' | 'rectangle' | 'line' | 'number-field' | 'blank-field' | 'image-placeholder'
  x: number
  y: number
  width: number
  height: number
  text?: string
  fontSize?: number
  fontWeight?: 'normal' | 'bold'
  fill?: string
  label?: string
}

export interface Template {
  id: string
  name: string
  category: 'general' | 'invoice' | 'receipt' | 'slip'
  tier: 'free' | 'starter'
  paperSize: PaperSizeName
  orientation: Orientation
  thumbnail: string
  defaultNumbering: Omit<NumberingConfig, 'total'>
  elements: TemplateElement[]
}

export const TEMPLATES: Template[] = [
  {
    id: 'simple-receipt',
    name: 'Simple Receipt',
    category: 'receipt',
    tier: 'free',
    paperSize: 'A5',
    orientation: 'portrait',
    thumbnail: '',
    defaultNumbering: { prefix: 'REC-', start: 1, digits: 4, step: 1, suffix: '' },
    elements: [
      { type: 'rectangle', x: 0, y: 0, width: 100, height: 12, fill: '#1A3A5C' },
      { type: 'text', x: 5, y: 2, width: 50, height: 8, text: 'RECEIPT', fontSize: 18, fontWeight: 'bold', fill: '#ffffff' },
      { type: 'number-field', x: 55, y: 2, width: 40, height: 8 },
      { type: 'blank-field', x: 5, y: 15, width: 90, height: 5, label: 'Received from' },
      { type: 'blank-field', x: 5, y: 23, width: 90, height: 5, label: 'The sum of' },
      { type: 'blank-field', x: 5, y: 31, width: 60, height: 5, label: 'For' },
      { type: 'line', x: 0, y: 85, width: 100, height: 0, fill: '#E8E5E0' },
      { type: 'blank-field', x: 5, y: 88, width: 40, height: 5, label: 'Signature' },
      { type: 'blank-field', x: 55, y: 88, width: 40, height: 5, label: 'Date' },
    ],
  },
  {
    id: 'professional-invoice',
    name: 'Professional Invoice',
    category: 'invoice',
    tier: 'free',
    paperSize: 'A4',
    orientation: 'portrait',
    thumbnail: '',
    defaultNumbering: { prefix: 'INV-', start: 1001, digits: 4, step: 1, suffix: '' },
    elements: [
      { type: 'rectangle', x: 0, y: 0, width: 100, height: 8, fill: '#1A3A5C' },
      { type: 'text', x: 4, y: 1.5, width: 40, height: 5, text: 'INVOICE', fontSize: 22, fontWeight: 'bold', fill: '#ffffff' },
      { type: 'number-field', x: 60, y: 1.5, width: 36, height: 5 },
      { type: 'image-placeholder', x: 4, y: 10, width: 20, height: 10, label: 'Logo' },
      { type: 'blank-field', x: 4, y: 22, width: 44, height: 4, label: 'Bill To' },
      { type: 'blank-field', x: 52, y: 22, width: 44, height: 4, label: 'Invoice Date' },
      { type: 'rectangle', x: 0, y: 38, width: 100, height: 6, fill: '#E8E5E0' },
      { type: 'text', x: 2, y: 39, width: 50, height: 4, text: 'Description', fontSize: 10, fontWeight: 'bold', fill: '#1A1A1A' },
      { type: 'text', x: 70, y: 39, width: 28, height: 4, text: 'Amount', fontSize: 10, fontWeight: 'bold', fill: '#1A1A1A' },
      { type: 'blank-field', x: 2, y: 46, width: 50, height: 4, label: 'Item 1' },
      { type: 'blank-field', x: 70, y: 46, width: 28, height: 4, label: 'ZWL' },
      { type: 'blank-field', x: 2, y: 52, width: 50, height: 4, label: 'Item 2' },
      { type: 'blank-field', x: 70, y: 52, width: 28, height: 4, label: 'ZWL' },
      { type: 'line', x: 60, y: 80, width: 38, height: 0, fill: '#1A1A1A' },
      { type: 'text', x: 60, y: 82, width: 16, height: 4, text: 'TOTAL', fontSize: 11, fontWeight: 'bold', fill: '#1A1A1A' },
      { type: 'blank-field', x: 76, y: 82, width: 22, height: 4, label: 'ZWL' },
      { type: 'blank-field', x: 4, y: 90, width: 40, height: 4, label: 'Authorised Signature' },
    ],
  },
  {
    id: 'cash-receipt',
    name: 'Cash Receipt',
    category: 'receipt',
    tier: 'free',
    paperSize: 'A6',
    orientation: 'portrait',
    thumbnail: '',
    defaultNumbering: { prefix: '', start: 1, digits: 5, step: 1, suffix: '' },
    elements: [
      { type: 'text', x: 5, y: 3, width: 90, height: 10, text: 'CASH RECEIPT', fontSize: 16, fontWeight: 'bold', fill: '#1A3A5C' },
      { type: 'number-field', x: 5, y: 14, width: 90, height: 8 },
      { type: 'line', x: 0, y: 24, width: 100, height: 0, fill: '#E8E5E0' },
      { type: 'blank-field', x: 5, y: 27, width: 90, height: 6, label: 'Received from' },
      { type: 'blank-field', x: 5, y: 36, width: 55, height: 6, label: 'Amount (ZWL)' },
      { type: 'blank-field', x: 63, y: 36, width: 32, height: 6, label: 'Date' },
      { type: 'blank-field', x: 5, y: 45, width: 90, height: 6, label: 'Purpose / Payment for' },
      { type: 'blank-field', x: 5, y: 80, width: 40, height: 6, label: 'Cashier' },
    ],
  },
  {
    id: 'delivery-slip',
    name: 'Delivery Slip',
    category: 'slip',
    tier: 'free',
    paperSize: 'Slip/Register',
    orientation: 'portrait',
    thumbnail: '',
    defaultNumbering: { prefix: 'DS-', start: 1, digits: 4, step: 1, suffix: '' },
    elements: [
      { type: 'rectangle', x: 0, y: 0, width: 100, height: 18, fill: '#E85D24' },
      { type: 'text', x: 4, y: 3, width: 55, height: 12, text: 'DELIVERY SLIP', fontSize: 14, fontWeight: 'bold', fill: '#ffffff' },
      { type: 'number-field', x: 52, y: 3, width: 44, height: 12 },
      { type: 'blank-field', x: 4, y: 22, width: 92, height: 14, label: 'Deliver to' },
      { type: 'blank-field', x: 4, y: 40, width: 92, height: 14, label: 'Items' },
      { type: 'blank-field', x: 4, y: 60, width: 44, height: 14, label: 'Recipient signature' },
      { type: 'blank-field', x: 52, y: 60, width: 44, height: 14, label: 'Date' },
    ],
  },
  {
    id: 'rent-receipt',
    name: 'Rent Receipt',
    category: 'receipt',
    tier: 'starter',
    paperSize: 'A5',
    orientation: 'portrait',
    thumbnail: '',
    defaultNumbering: { prefix: 'RNT-', start: 1, digits: 4, step: 1, suffix: '' },
    elements: [
      { type: 'rectangle', x: 0, y: 0, width: 100, height: 14, fill: '#1A3A5C' },
      { type: 'text', x: 4, y: 2, width: 60, height: 10, text: 'RENT RECEIPT', fontSize: 18, fontWeight: 'bold', fill: '#ffffff' },
      { type: 'number-field', x: 60, y: 2, width: 36, height: 10 },
      { type: 'blank-field', x: 5, y: 18, width: 90, height: 6, label: 'Tenant name' },
      { type: 'blank-field', x: 5, y: 27, width: 90, height: 6, label: 'Property address' },
      { type: 'blank-field', x: 5, y: 36, width: 55, height: 6, label: 'Amount paid' },
      { type: 'blank-field', x: 63, y: 36, width: 32, height: 6, label: 'Date' },
      { type: 'blank-field', x: 5, y: 45, width: 55, height: 6, label: 'Period covered' },
      { type: 'blank-field', x: 63, y: 45, width: 32, height: 6, label: 'Payment method' },
      { type: 'line', x: 0, y: 82, width: 100, height: 0, fill: '#E8E5E0' },
      { type: 'blank-field', x: 5, y: 85, width: 40, height: 6, label: 'Landlord signature' },
    ],
  },
  {
    id: 'service-receipt',
    name: 'Service Receipt',
    category: 'receipt',
    tier: 'starter',
    paperSize: 'A5',
    orientation: 'portrait',
    thumbnail: '',
    defaultNumbering: { prefix: 'SRV-', start: 1, digits: 4, step: 1, suffix: '' },
    elements: [
      { type: 'image-placeholder', x: 4, y: 3, width: 22, height: 10, label: 'Logo' },
      { type: 'text', x: 28, y: 3, width: 68, height: 6, text: 'SERVICE RECEIPT', fontSize: 16, fontWeight: 'bold', fill: '#1A3A5C' },
      { type: 'number-field', x: 28, y: 10, width: 68, height: 6 },
      { type: 'line', x: 0, y: 16, width: 100, height: 0, fill: '#E85D24' },
      { type: 'blank-field', x: 4, y: 20, width: 90, height: 6, label: 'Client name' },
      { type: 'blank-field', x: 4, y: 29, width: 90, height: 6, label: 'Service description' },
      { type: 'blank-field', x: 4, y: 38, width: 55, height: 6, label: 'Labour cost' },
      { type: 'blank-field', x: 63, y: 38, width: 33, height: 6, label: 'Parts cost' },
      { type: 'rectangle', x: 55, y: 74, width: 41, height: 8, fill: '#1A3A5C' },
      { type: 'text', x: 57, y: 75.5, width: 18, height: 5, text: 'TOTAL', fontSize: 10, fontWeight: 'bold', fill: '#ffffff' },
      { type: 'blank-field', x: 76, y: 75, width: 18, height: 6, label: '' },
      { type: 'blank-field', x: 4, y: 86, width: 40, height: 6, label: 'Technician signature' },
      { type: 'blank-field', x: 55, y: 86, width: 41, height: 6, label: 'Date' },
    ],
  },
]

export const FREE_TEMPLATE_IDS = new Set(
  TEMPLATES.filter((t) => t.tier === 'free').map((t) => t.id),
)

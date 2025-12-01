'use strict';

const { z } = require('zod');

const ALLOWED_CURRENCIES = (process.env.ALLOWED_CURRENCIES || 'SAR,USD,AED,EUR')
  .split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

function toDetails(zodError) {
  return zodError.errors.map(e => ({
    field: (e.path || []).join('.') || undefined,
    message: e.message
  }));
}

function withValidation(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', details: toDetails(parsed.error) });
    }
    req.validated = parsed.data;
    // Replace body so downstream handlers see normalized values
    req.body = parsed.data;
    next();
  };
}

const productCreateBase = z.object({
  name: z.string({ required_error: 'name is required' }).min(1, 'name is required'),
  description: z.string().optional(),
  price: z.number().finite().nonnegative('price must be positive number').optional(),
  currency: z.string().length(3, 'currency must be 3 letters').transform(s => s.toUpperCase()).refine(v => !v || ALLOWED_CURRENCIES.includes(v), 'unsupported currency').optional(),
  vendorId: z.string().min(1).optional(),
  countryCode: z.string().length(2, 'countryCode must be 2 letters').transform(s => s.toUpperCase()).optional(),
  category: z.string().min(1).optional(),
  media: z.array(z.any()).optional()
}).strict();

const schemas = {
  // POST /api/(v1/)market/products
  productCreate: productCreateBase,
  // POST /api/(v1/)market/cart
  cartAdd: z.object({
    sku: z.string({ required_error: 'sku is required' }).min(1, 'sku is required'),
    quantity: z.preprocess(v => (v === undefined ? 1 : v), z.number().int('quantity must be integer').min(1, 'quantity must be >=1')).optional()
  }).strict(),
  // PUT /api/(v1/)market/cart (replace full list)
  cartReplace: z.object({
    items: z.array(z.object({
      sku: z.string().min(1, 'sku required'),
      quantity: z.preprocess(v => (v === undefined ? 1 : v), z.number().int().min(1)).optional()
    })).min(0).optional()
  }).strict(),
  // POST /api/(v1/)market/cart/merge (merge guest items)
  cartMerge: z.object({
    items: z.array(z.object({
      sku: z.string().min(1, 'sku required'),
      quantity: z.preprocess(v => (v === undefined ? 1 : v), z.number().int().min(1)).optional()
    })).min(1, 'at least one item required'),
    mode: z.enum(['add','replace']).optional()
  }).strict(),
  // POST /api/(v1/)market/orders
  orderCreate: z.object({
    currency: z.string().length(3, 'currency must be 3 letters').transform(s => s.toUpperCase()).refine(v => ALLOWED_CURRENCIES.includes(v), 'unsupported currency').optional(),
    shippingAddress: z.object({
      name: z.string().min(1).optional(),
      line1: z.string().min(1),
      line2: z.string().optional(),
      city: z.string().min(1),
      state: z.string().optional(),
      postalCode: z.string().min(1).optional(),
      countryCode: z.string().length(2).transform(s => s.toUpperCase()).optional(),
      phone: z.string().optional()
    }).optional()
  }).strict(),
  // POST /api/(v1/)market/seller/products
  sellerProductCreate: productCreateBase
};

module.exports = { withValidation, schemas };

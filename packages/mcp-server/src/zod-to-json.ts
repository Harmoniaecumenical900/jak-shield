import { z } from 'zod';

/**
 * Tiny Zod -> JSON Schema converter sufficient for the shapes we use:
 * objects with string/number/boolean/enum/record/optional/default/array fields.
 * Keeps the package free of zod-to-json-schema as a dep.
 */
export function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return convert(schema);
}

function convert(node: z.ZodTypeAny): Record<string, unknown> {
  if (node instanceof z.ZodOptional) return { ...convert(node._def.innerType), optional: true };
  if (node instanceof z.ZodDefault) return { ...convert(node._def.innerType), default: node._def.defaultValue() };
  if (node instanceof z.ZodNullable) return { ...convert(node._def.innerType), nullable: true };
  if (node instanceof z.ZodString) return { type: 'string' };
  if (node instanceof z.ZodNumber) return { type: 'number' };
  if (node instanceof z.ZodBoolean) return { type: 'boolean' };
  if (node instanceof z.ZodEnum) return { type: 'string', enum: node._def.values };
  if (node instanceof z.ZodArray) return { type: 'array', items: convert(node._def.type) };
  if (node instanceof z.ZodRecord) return { type: 'object', additionalProperties: convert(node._def.valueType) };
  if (node instanceof z.ZodObject) {
    const shape = node._def.shape();
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [k, v] of Object.entries(shape)) {
      const child = convert(v as z.ZodTypeAny);
      const isOptional = (v as z.ZodTypeAny).isOptional?.() ?? false;
      const hasDefault = v instanceof z.ZodDefault;
      delete (child as Record<string, unknown>)['optional'];
      properties[k] = child;
      if (!isOptional && !hasDefault) required.push(k);
    }
    return { type: 'object', properties, ...(required.length ? { required } : {}) };
  }
  if (node instanceof z.ZodUnion) return { anyOf: node._def.options.map(convert) };
  if (node instanceof z.ZodLiteral) return { const: node._def.value };
  if (node instanceof z.ZodAny || node instanceof z.ZodUnknown) return {};
  return {};
}

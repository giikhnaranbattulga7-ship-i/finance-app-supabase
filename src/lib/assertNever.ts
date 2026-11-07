// Шинэ union гишүүн нэмэгдэхэд switch дутуу үлдвэл хөрвүүлэгч алдаа өгнө.
export function assertNever(value: never, message = 'Тодорхойгүй утга'): never {
  throw new Error(`${message}: ${String(value)}`);
}

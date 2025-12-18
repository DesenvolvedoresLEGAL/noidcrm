/**
 * Validates a Brazilian CPF number using the module 11 algorithm
 */
export function validateCPF(cpf: string): boolean {
  // Remove non-numeric characters
  const cleanCPF = cpf.replace(/\D/g, '');

  // CPF must have 11 digits
  if (cleanCPF.length !== 11) {
    return false;
  }

  // CPFs with all same digits are invalid
  if (/^(\d)\1{10}$/.test(cleanCPF)) {
    return false;
  }

  // Calculate first check digit
  let sum1 = 0;
  for (let i = 0; i < 9; i++) {
    sum1 += parseInt(cleanCPF[i]) * (10 - i);
  }
  let d1 = (sum1 * 10) % 11;
  if (d1 === 10) d1 = 0;

  // Calculate second check digit
  let sum2 = 0;
  for (let i = 0; i < 10; i++) {
    sum2 += parseInt(cleanCPF[i]) * (11 - i);
  }
  let d2 = (sum2 * 10) % 11;
  if (d2 === 10) d2 = 0;

  // Verify check digits
  return d1 === parseInt(cleanCPF[9]) && d2 === parseInt(cleanCPF[10]);
}

/**
 * Formats a CPF string to the standard format: 000.000.000-00
 */
export function formatCPF(cpf: string): string {
  const cleanCPF = cpf.replace(/\D/g, '');
  if (cleanCPF.length !== 11) return cpf;
  return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Removes formatting from CPF
 */
export function cleanCPF(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

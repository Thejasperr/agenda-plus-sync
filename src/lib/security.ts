import { z } from 'zod';

// Input sanitization utility
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return '';
  
  // Remove potentially dangerous characters and normalize
  return input
    .replace(/[<>"/\\&]/g, '') // Remove HTML/script injection chars
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .slice(0, 500); // Limit length
};

// Phone number validation and formatting
export const validateAndFormatPhone = (phone: string): { isValid: boolean; formatted: string; error?: string } => {
  if (!phone) return { isValid: false, formatted: '', error: 'Telefone é obrigatório' };
  
  // Remove all non-digits
  let digits = phone.replace(/\D/g, '');

  // If already has country code 55 (12 or 13 digits), strip it temporarily for validation
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    digits = digits.slice(2);
  }

  // Brazilian phone validation (10 or 11 digits without country code)
  if (digits.length < 10 || digits.length > 11) {
    return { isValid: false, formatted: phone, error: 'Telefone deve ter 10 ou 11 dígitos' };
  }

  // Always save WITH the 55 country code prefix
  const cleanFormatted = `55${digits}`;

  return { isValid: true, formatted: cleanFormatted };
};

// Email validation
export const validateEmail = (email: string): { isValid: boolean; error?: string } => {
  const emailSchema = z.string().email('Email inválido').min(1, 'Email é obrigatório');
  
  try {
    emailSchema.parse(email);
    return { isValid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { isValid: false, error: error.errors[0]?.message || 'Email inválido' };
    }
    return { isValid: false, error: 'Email inválido' };
  }
};

// Enhanced password validation
export const validatePassword = (password: string): { isValid: boolean; error?: string } => {
  if (!password) return { isValid: false, error: 'Senha é obrigatória' };
  
  if (password.length < 8) {
    return { isValid: false, error: 'Senha deve ter pelo menos 8 caracteres' };
  }
  
  if (!/(?=.*[a-z])/.test(password)) {
    return { isValid: false, error: 'Senha deve conter pelo menos uma letra minúscula' };
  }
  
  if (!/(?=.*[A-Z])/.test(password)) {
    return { isValid: false, error: 'Senha deve conter pelo menos uma letra maiúscula' };
  }
  
  if (!/(?=.*\d)/.test(password)) {
    return { isValid: false, error: 'Senha deve conter pelo menos um número' };
  }
  
  return { isValid: true };
};

// Secure error handling - avoid exposing technical details
export const getSecureErrorMessage = (error: any, context: string = 'operação'): string => {
  // Log full error for debugging (in development only)
  if (process.env.NODE_ENV === 'development') {
    console.warn(`Security: Error in ${context}:`, error);
  }
  
  // Don't expose technical details to users
  if (error?.code === '23505') {
    return 'Este registro já existe no sistema';
  }
  
  if (error?.code === '23503') {
    return 'Não é possível realizar esta operação devido a dependências';
  }
  
  if (error?.message?.includes('JWT')) {
    return 'Sessão expirada. Faça login novamente';
  }
  
  if (error?.message?.includes('Network')) {
    return 'Erro de conexão. Verifique sua internet';
  }
  
  if (error?.message?.includes('duplicate key')) {
    return 'Registro duplicado encontrado';
  }
  
  // Generic secure message
  return `Não foi possível completar a ${context}. Tente novamente`;
};

// Form validation schemas
export const clienteSchema = z.object({
  nome: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome muito longo')
    .refine(val => sanitizeInput(val).length > 0, 'Nome é obrigatório'),
  telefone: z.string()
    .refine(val => validateAndFormatPhone(val).isValid, 'Telefone inválido')
});

export const servicoSchema = z.object({
  nome_procedimento: z.string()
    .min(2, 'Nome do procedimento deve ter pelo menos 2 caracteres')
    .max(100, 'Nome muito longo')
    .refine(val => sanitizeInput(val).length > 0, 'Nome do procedimento é obrigatório'),
  valor: z.number()
    .min(0.01, 'Valor deve ser maior que zero')
    .max(99999.99, 'Valor muito alto')
});

export const agendamentoSchema = z.object({
  nome: z.string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome muito longo')
    .refine(val => sanitizeInput(val).length > 0, 'Nome é obrigatório'),
  telefone: z.string()
    .refine(val => validateAndFormatPhone(val).isValid, 'Telefone inválido'),
  preco: z.number()
    .min(0, 'Preço não pode ser negativo')
    .max(99999.99, 'Preço muito alto'),
  data_agendamento: z.string().min(1, 'Data é obrigatória'),
  hora_agendamento: z.string().min(1, 'Hora é obrigatória'),
  observacoes: z.string().max(500, 'Observações muito longas').optional()
});

// Rate limiting helper for auth attempts
let authAttempts: { [key: string]: { count: number; lastAttempt: Date } } = {};

export const checkRateLimit = (identifier: string, maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000): boolean => {
  const now = new Date();
  const userAttempts = authAttempts[identifier];
  
  if (!userAttempts) {
    authAttempts[identifier] = { count: 1, lastAttempt: now };
    return true;
  }
  
  // Reset if window has passed
  if (now.getTime() - userAttempts.lastAttempt.getTime() > windowMs) {
    authAttempts[identifier] = { count: 1, lastAttempt: now };
    return true;
  }
  
  if (userAttempts.count >= maxAttempts) {
    return false;
  }
  
  userAttempts.count++;
  userAttempts.lastAttempt = now;
  return true;
};

// Clean up rate limiting data periodically
setInterval(() => {
  const now = new Date();
  Object.keys(authAttempts).forEach(key => {
    if (now.getTime() - authAttempts[key].lastAttempt.getTime() > 15 * 60 * 1000) {
      delete authAttempts[key];
    }
  });
}, 5 * 60 * 1000); // Clean every 5 minutes
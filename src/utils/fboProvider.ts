/**
 * FBO (For-Benefit-Of) Provider Stub
 * 
 * This module will be replaced with a real Airwallex/Currencycloud SDK
 * integration for KYC pass-through and FBO account creation.
 * 
 * PII is sent DIRECTLY from the device to the FBO provider —
 * it never touches the Supabase backend.
 */

export interface FBOFormData {
  name: string;
  email: string;
  phone: string;
}

export interface FBOResult {
  success: boolean;
  fboAccountId?: string;
  kycStatus?: 'pending' | 'approved' | 'rejected';
  message: string;
}

export async function sendToFBOProvider(
  formData: FBOFormData,
  acaHash: string
): Promise<FBOResult> {
  console.log('[FBO Stub] Sending KYC data directly to FBO provider...');
  console.log('[FBO Stub] ACA Hash:', acaHash);
  console.log('[FBO Stub] Data categories:', Object.keys(formData).join(', '));

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 800));

  // Stub response — replace with real SDK call
  return {
    success: true,
    fboAccountId: `FBO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    kycStatus: 'pending',
    message: 'KYC submission received. Verification in progress.',
  };
}

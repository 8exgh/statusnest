import { createHmac } from 'crypto';
import { NextResponse } from 'next/server';

const API_KEY = process.env.BACKGROUND_PROCESSOR_API_KEY || 'development-key-change-in-production';

export async function validateInternalRequest(req: Request): Promise<boolean> {
  const apiKey = req.headers.get('X-API-Key');
  const signature = req.headers.get('X-Signature');
  
  if (apiKey !== API_KEY) {
    return false;
  }
  
  const body = await req.text();
  const expectedSignature = createHmac('sha256', API_KEY)
    .update(body)
    .digest('hex');
    
  return signature === expectedSignature;
}

export function createInternalResponse(data: any): Response {
  const body = JSON.stringify(data);
  const signature = createHmac('sha256', API_KEY)
    .update(body)
    .digest('hex');
    
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': signature
    }
  });
}

export async function withInternalAuth(
  req: Request,
  handler: (req: Request) => Promise<Response>
): Promise<Response> {
  const clonedReq = req.clone();
  
  if (!(await validateInternalRequest(clonedReq))) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  return handler(req);
}
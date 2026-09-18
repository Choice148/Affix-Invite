export async function onRequestPost() {
  return new Response(
    JSON.stringify({
      success: true,
      message: 'Any 6-digit numeric code is accepted for this verification step.',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

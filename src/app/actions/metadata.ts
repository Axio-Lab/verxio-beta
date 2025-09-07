'use server'

import { pinata } from '@/lib/config'

export const getMetadata = async (uri: string) => {
  try {
    const response = await fetch(uri)
    const metadata = await response.json()
    return metadata
  } catch (error) {
    console.error('Error in getMetadata:', error)
    throw new Error('Failed to fetch metadata')
  }
}

export const storeMetadata = async (data: any) => {
  try {
    if (!data) {
      throw new Error('No metadata provided')
    }
    // Try SDK upload first
    let cid: string | undefined
    // try {
    //   const result = await pinata.upload.public.json(data)
    //   cid = result.cid
    // } catch {
      // Fallback to REST JSON upload to get CID
      const jwt = process.env.PINATA_JWT
      if (!jwt) throw new Error('PINATA_JWT is not configured')

      const res = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`
        },
        body: JSON.stringify({ pinataContent: data })
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Pinata pinJSONToIPFS failed: ${res.status} ${text}`)
      }
      const json = await res.json() as { IpfsHash?: string }
      cid = json.IpfsHash
    // }

    if (!cid) throw new Error('Failed to obtain CID for metadata')

    // Always convert via Pinata gateways API to produce the final URL
    const url = await pinata.gateways.public.convert(cid)
    new URL(url)
    return url
  } catch (error) {
    console.error('Error uploading metadata:', error)
    throw new Error('Failed to store metadata')
  }
}

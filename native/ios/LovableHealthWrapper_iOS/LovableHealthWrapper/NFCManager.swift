//
//  NFCManager.swift
//  LovableHealthWrapper
//
//  Created by Edward Elam on 4/30/26.
//

import Foundation
import CoreNFC
import UIKit

// MARK: - IDIA Protocol: Production NFC Hardware Manager
class NFCManager: NSObject, NFCNDEFReaderSessionDelegate {
    
    private var nfcSession: NFCNDEFReaderSession?
    private var completionHandler: ((Result<String, Error>) -> Void)?
    
    // Lineage-locked ACA and Payment Signature
    private var activeAcaHash: String?
    private var activeBaseSignature: String?

    // ─── CANONICAL HANDSHAKE ENTRY POINT ──────────────────────────────────────
    func beginHandshake(withConfig config: [String: Any], completion: @escaping (Result<String, Error>) -> Void) {
        print("🛜 [BEGIN: NFCManager.beginHandshake] Activating CoreNFC Reader Session")
        
        let expectedRail = config["expected_rail"] as? String ?? "usdc"
        let transactionAmount = config["transaction_amount"] as? String ?? "0"
        
        // Extract lineage identifiers from config
        let masterAcaHash = config["aca_hash"] as? String ?? "NON_TRANSACTIONAL"
        let baseSignature = config["base_signature"] as? String ?? "pending_signature"
        
        print("🛜 [PROCESS: NFCManager.beginHandshake] Expecting Peer for \(transactionAmount) \(expectedRail.uppercased())")
        
        guard NFCNDEFReaderSession.readingAvailable else {
            print("🚨 [FAIL: NFCManager.beginHandshake] ERROR: Hardware unsupported or disabled.")
            completion(.failure(NSError(domain: "NFCManager", code: 1, userInfo: [NSLocalizedDescriptionKey: "NFC is not available on this device."])))
            return
        }
        
        self.activeAcaHash = masterAcaHash
        self.activeBaseSignature = baseSignature
        self.completionHandler = completion
        
        self.nfcSession = NFCNDEFReaderSession(delegate: self, queue: nil, invalidateAfterFirstRead: true)
        self.nfcSession?.alertMessage = "Hold near receiving device to sync \(expectedRail.uppercased()) rail."
        self.nfcSession?.begin()
        
        print("🛜 [END: NFCManager.beginHandshake] Session UI presented to user.")
    }

    // MARK: - NFCNDEFReaderSessionDelegate

    func readerSession(_ session: NFCNDEFReaderSession, didInvalidateWithError error: Error) {
        print("🚨 [BEGIN: NFCManager.readerSession.didInvalidate] Session Invalidated")
        if let nfcError = error as? NFCReaderError {
            if nfcError.code != .readerSessionInvalidationErrorUserCanceled {
                print("🚨 [FAIL: NFCManager.readerSession.didInvalidate] ERROR: \(nfcError.localizedDescription)")
                completionHandler?(.failure(nfcError))
            } else {
                print("🛜 [PROCESS: NFCManager.readerSession.didInvalidate] ACTION: User canceled session manually.")
            }
        }
        print("🚨 [END: NFCManager.readerSession.didInvalidate] Hardware session closed.")
        self.nfcSession = nil
    }

    func readerSession(_ session: NFCNDEFReaderSession, didDetectNDEFs messages: [NFCNDEFMessage]) {
        print("🛜 [BEGIN: NFCManager.readerSession.didDetectNDEFs] Signal Detected")
        
        // IDIA Handshake Protocol: We look for the first record in the first message
        guard let firstRecord = messages.first?.records.first else {
            print("🚨 [FAIL: NFCManager.readerSession.didDetectNDEFs] ERROR: Empty Payload.")
            return
        }

        // Extracting the terminal's broadcast payload (e.g., Flexa Session ID)
        let scannedPayload = String(data: firstRecord.payload.advanced(by: 3), encoding: .utf8) ?? ""
        
        print("🛜 [PROCESS: NFCManager.readerSession.didDetectNDEFs] Terminal Payload Captured: \(scannedPayload)")
        
        // Construct the Omni-Payload (Financial + Identity)
        let responseDict: [String: Any] = [
            "scanned_intent": scannedPayload,
            "aca_hash": self.activeAcaHash ?? "",
            "base_signature": self.activeBaseSignature ?? "",
            "timestamp": ISO8601DateFormatter().string(from: Date())
        ]
        
        var jsonString = "{}"
        if let jsonData = try? JSONSerialization.data(withJSONObject: responseDict, options: []),
           let converted = String(data: jsonData, encoding: .utf8) {
            jsonString = converted
        }
        
        // Trigger Haptic Feedback for physical confirmation
        let feedback = UINotificationFeedbackGenerator()
        feedback.notificationOccurred(.success)

        DispatchQueue.main.async {
            self.completionHandler?(.success(jsonString))
            print("🛜 [END: NFCManager.readerSession.didDetectNDEFs] Transmitting Omni-Payload to WebView Bridge.")
        }
    }
}

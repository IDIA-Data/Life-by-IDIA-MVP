import Foundation
import HealthKit
import CryptoKit
import WebKit
import UIKit

// MARK: - IDIA Protocol: High-Fidelity HealthKit Manager (ULTRA-WIDE SOVEREIGN)
class HealthKitManager: ObservableObject {
    private let healthStore = HKHealthStore()
    weak var webView: WKWebView?
    
    // ─── CANONICAL SYNC ENTRY POINT ──────────────────────────────────────────
    func triggerHealthDataSync(withConfig config: [String: Any], requestedDataTypes: [String: [String]]) {
        print("🍏 [SYNC_INIT_START] Firing canonical synchronization engine...")
        
        let userId = config["user_id"] as? String ?? "unknown_principal"
        let sessionId = config["sync_session_id"] as? String ?? ""
        
        guard let masterAcaHash = config["aca_hash_key"] as? String else {
            print("🚨 [SYNC_TRACE] FATAL: No Master ACA Beacon provided. Aborting sync.")
            self.reportErrorToWeb("Missing Master ACA Beacon", sessionId: sessionId)
            return
        }
        
        print("🍏 [SYNC_TRACE] Lineage Identified: [\(masterAcaHash.prefix(12))...]")

        // 1. ULTRA-WIDE READ TYPES (The Absolute Sovereign Set)
        let typesToRead: Set<HKObjectType> = [
            // Core Physiological Distress (Kill-Switch)
            HKQuantityType.quantityType(forIdentifier: .heartRate)!,
            HKQuantityType.quantityType(forIdentifier: .heartRateVariabilitySDNN)!,
            HKQuantityType.quantityType(forIdentifier: .restingHeartRate)!,
            HKQuantityType.quantityType(forIdentifier: .respiratoryRate)!,
            HKQuantityType.quantityType(forIdentifier: .oxygenSaturation)!,
            HKQuantityType.quantityType(forIdentifier: .bodyTemperature)!,
            HKQuantityType.quantityType(forIdentifier: .bloodPressureSystolic)!,
            HKQuantityType.quantityType(forIdentifier: .bloodPressureDiastolic)!,
            
            // Kinetic Pattern of Life (Industrial Athlete Fatigue)
            HKQuantityType.quantityType(forIdentifier: .stepCount)!,
            HKQuantityType.quantityType(forIdentifier: .distanceWalkingRunning)!,
            HKQuantityType.quantityType(forIdentifier: .walkingSpeed)!,
            HKQuantityType.quantityType(forIdentifier: .walkingStepLength)!,
            HKQuantityType.quantityType(forIdentifier: .walkingAsymmetryPercentage)!,
            HKQuantityType.quantityType(forIdentifier: .walkingDoubleSupportPercentage)!,
            HKQuantityType.quantityType(forIdentifier: .appleWalkingSteadiness)!, // High-Fidelity Stability
            HKQuantityType.quantityType(forIdentifier: .stairAscentSpeed)!,
            HKQuantityType.quantityType(forIdentifier: .stairDescentSpeed)!,
            
            // Energy & Environmental Stress
            HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned)!,
            HKQuantityType.quantityType(forIdentifier: .basalEnergyBurned)!,
            HKQuantityType.quantityType(forIdentifier: .vo2Max)!,
            HKQuantityType.quantityType(forIdentifier: .environmentalAudioExposure)!,
            HKQuantityType.quantityType(forIdentifier: .uvExposure)!, // Solar Stress Telemetry
            
            // State Analysis
            HKCategoryType.categoryType(forIdentifier: .sleepAnalysis)!
        ]
        
        print("🍏 [SYNC_AUTH_START] Requesting absolute hardware access to \(typesToRead.count) pipes...")
        
        healthStore.requestAuthorization(toShare: nil, read: typesToRead) { [weak self] (success, error) in
            print("🍏 [SYNC_AUTH_END] Authorization result: \(success)")
            
            if let error = error {
                print("🚨 [SYNC_AUTH_ERROR] Detailed Failure: \(error.localizedDescription)")
            }
            
            guard let self = self, success else {
                self?.reportErrorToWeb("Authorization failed or denied.", sessionId: sessionId)
                return
            }
            
            // 2. ANCHOR PERSISTENCE
            print("💾 [SYNC_PERSIST_START] Locking lineage credentials...")
            UserDefaults.standard.set(masterAcaHash, forKey: "last_aca_hash_key")
            UserDefaults.standard.set(userId, forKey: "last_user_id")
            UserDefaults.standard.set(config["auth_token"] as? String, forKey: "last_auth_token")
            print("💾 [SYNC_PERSIST_END] Credentials stored for background bio-tethering.")
            
            // 3. ARM REAL-TIME OBSERVERS
            self.enableBackgroundDelivery(forTypes: Array(typesToRead))
            
            // 4. EXECUTE DEEP DISCOVERY (7-Day Horizon)
            self.executeFullAlphaSync(userId: userId, acaHash: masterAcaHash, config: config)
        }
    }

    // MARK: - REAL-TIME STREAM ENGINE
    func enableBackgroundDelivery(forTypes types: [HKObjectType]) {
        print("🍏 [STREAM_ENABLE_START] Priming background discovery valves...")
        for type in types {
            healthStore.enableBackgroundDelivery(for: type, frequency: .immediate) { [weak self] (success, error) in
                if success {
                    print("🍏 [STREAM] Valve Armed: \(type.identifier)")
                    self?.setupObserverQuery(for: type)
                } else if let error = error {
                    print("🚨 [STREAM_ERROR] Valve Failed for \(type.identifier): \(error.localizedDescription)")
                }
            }
        }
        print("🍏 [STREAM_ENABLE_END] All available valves primed.")
    }

    private func setupObserverQuery(for type: HKObjectType) {
        guard let sampleType = type as? HKSampleType else { return }
        let query = HKObserverQuery(sampleType: sampleType, predicate: nil) { [weak self] (query, completionHandler, error) in
            print("🍏 [STREAM_SIGNAL_START] Delta detected on [\(type.identifier)].")
            self?.executeBackgroundSync {
                print("🍏 [STREAM_SIGNAL_END] Background dispatch cycle complete.")
                completionHandler()
            }
        }
        healthStore.execute(query)
    }

    private func executeBackgroundSync(completion: @escaping () -> Void) {
        print("🍏 [BG_CYCLE_START] Initiating background egress...")
        
        var backgroundTask: UIBackgroundTaskIdentifier = .invalid
        backgroundTask = UIApplication.shared.beginBackgroundTask {
            print("🚨 [BG_CYCLE_TASK] OS revocation imminent. Terminating task.")
            UIApplication.shared.endBackgroundTask(backgroundTask)
            backgroundTask = .invalid
        }

        guard let storedAcaHash = UserDefaults.standard.string(forKey: "last_aca_hash_key"),
              let storedUserId = UserDefaults.standard.string(forKey: "last_user_id") else {
            print("🚨 [BG_CYCLE_ABORT] Missing session continuity credentials.")
            UIApplication.shared.endBackgroundTask(backgroundTask)
            completion()
            return
        }

        let config: [String: Any] = [
            "user_id": storedUserId,
            "aca_hash_key": storedAcaHash,
            "auth_token": UserDefaults.standard.string(forKey: "last_auth_token") ?? "",
            "sync_session_id": "bg_sync_\(UUID().uuidString.prefix(6))"
        ]
        
        self.executeFullAlphaSync(userId: storedUserId, acaHash: storedAcaHash, config: config) {
            UIApplication.shared.endBackgroundTask(backgroundTask)
            backgroundTask = .invalid
            completion()
        }
    }

    // MARK: - DATA HYDRATION ENGINE (THE FIREHOSE)
    private func executeFullAlphaSync(userId: String, acaHash: String, config: [String: Any], completion: (() -> Void)? = nil) {
        print("🍏 [FIREHOSE_START] Hydrating wide-open discovery (7-day window)...")
        
        let now = Date()
        let startDate = Calendar.current.date(byAdding: .day, value: -7, to: now)!
        let predicate = HKQuery.predicateForSamples(withStart: startDate, end: now, options: .strictStartDate)
        
        let dispatchGroup = DispatchGroup()
        var flattenedPayload: [[String: Any]] = []
        
        // --- HIGH-FIDELITY DISCOVERY HELPER ---
        func addToPipe(identifier: HKQuantityTypeIdentifier, label: String, unit: HKUnit) {
            dispatchGroup.enter()
            print("   ├─ [\(label)] DISCOVERING...")
            
            let type = HKQuantityType.quantityType(forIdentifier: identifier)!
            self.fetchSamples(type: type, predicate: predicate) { samples in
                let items = samples.compactMap { sample -> [String: Any]? in
                    let val = sample.quantity.doubleValue(for: unit)
                    
                    // Alpha-Tier Provenance & Fingerprinting
                    var meta = sample.metadata ?? [:]
                    meta["src_device"] = sample.device?.name ?? "Unknown"
                    meta["src_model"] = sample.device?.model ?? "iPhone"
                    meta["src_manufacturer"] = sample.device?.manufacturer ?? "Apple"
                    meta["src_version"] = sample.device?.hardwareVersion ?? "Native"
                    
                    return [
                        "value": val,
                        "dataType": label,
                        "startDate": ISO8601DateFormatter().string(from: sample.startDate),
                        "aca_hash_key": acaHash,
                        "platform_guid": userId,
                        "metadata": meta
                    ]
                }
                print("      └─ [\(label)] HYDRATED: \(items.count) records.")
                flattenedPayload.append(contentsOf: items)
                dispatchGroup.leave()
            }
        }

        // --- Execute Deep Discovery set ---
        addToPipe(identifier: .stepCount, label: "steps", unit: .count())
        addToPipe(identifier: .heartRate, label: "heartRate", unit: HKUnit.count().unitDivided(by: .minute()))
        addToPipe(identifier: .heartRateVariabilitySDNN, label: "hrv", unit: .secondUnit(with: .milli))
        addToPipe(identifier: .restingHeartRate, label: "restingHR", unit: HKUnit.count().unitDivided(by: .minute()))
        addToPipe(identifier: .oxygenSaturation, label: "bloodOxygen", unit: .percent())
        addToPipe(identifier: .respiratoryRate, label: "respiratoryRate", unit: HKUnit.count().unitDivided(by: .minute()))
        addToPipe(identifier: .walkingSpeed, label: "walkingSpeed", unit: HKUnit.mile().unitDivided(by: .hour()))
        addToPipe(identifier: .walkingStepLength, label: "stepLength", unit: .meter())
        addToPipe(identifier: .walkingAsymmetryPercentage, label: "walkingAsymmetry", unit: .percent())
        addToPipe(identifier: .walkingDoubleSupportPercentage, label: "doubleSupport", unit: .percent())
        addToPipe(identifier: .appleWalkingSteadiness, label: "steadiness", unit: .percent())
        addToPipe(identifier: .activeEnergyBurned, label: "calories", unit: .kilocalorie())
        addToPipe(identifier: .basalEnergyBurned, label: "basalEnergy", unit: .kilocalorie())
        addToPipe(identifier: .environmentalAudioExposure, label: "noiseLevel", unit: .decibelAWeightedSoundPressureLevel())
        addToPipe(identifier: .uvExposure, label: "uvExposure", unit: .count())
        addToPipe(identifier: .bodyTemperature, label: "bodyTemp", unit: .degreeFahrenheit())
        addToPipe(identifier: .vo2Max, label: "vo2max", unit: HKUnit.literUnit(with: .milli).unitDivided(by: .gramUnit(with: .kilo).unitMultiplied(by: .minute())))
        addToPipe(identifier: .bloodPressureSystolic, label: "bpSystolic", unit: .millimeterOfMercury())
        addToPipe(identifier: .bloodPressureDiastolic, label: "bpDiastolic", unit: .millimeterOfMercury())

        // Sleep Discovery (Category)
        dispatchGroup.enter()
        print("   ├─ [sleep] DISCOVERING...")
        let sleepType = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis)!
        let sleepQuery = HKSampleQuery(sampleType: sleepType, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
            let items = (samples as? [HKCategorySample] ?? []).map { sample -> [String: Any] in
                return [
                    "value": sample.value,
                    "dataType": "sleep",
                    "startDate": ISO8601DateFormatter().string(from: sample.startDate),
                    "endDate": ISO8601DateFormatter().string(from: sample.endDate),
                    "aca_hash_key": acaHash,
                    "platform_guid": userId,
                    "metadata": sample.metadata ?? [:]
                ]
            }
            print("      └─ [sleep] HYDRATED: \(items.count) records.")
            flattenedPayload.append(contentsOf: items)
            dispatchGroup.leave()
        }
        healthStore.execute(sleepQuery)

        // 6. FINAL EGRESS
        dispatchGroup.notify(queue: .main) {
            print("🍏 [FIREHOSE_END] Hydration complete. Dispatching \(flattenedPayload.count) lineage-locked records.")
            self.sendBulkToUniversityHub(payload: flattenedPayload, acaHash: acaHash, config: config) {
                completion?()
            }
        }
    }
    
    private func fetchSamples(type: HKQuantityType, predicate: NSPredicate, completion: @escaping ([HKQuantitySample]) -> Void) {
        let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
            completion(samples as? [HKQuantitySample] ?? [])
        }
        healthStore.execute(query)
    }

    private func sendBulkToUniversityHub(payload: [[String: Any]], acaHash: String, config: [String: Any], completion: (() -> Void)? = nil) {
        print("🍏 [EGRESS_START] Transmitting payload to Supabase Hub...")
        
        let endpoint = "https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/apple-health-sync"
        guard let url = URL(string: endpoint) else { completion?(); return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(config["auth_token"] as? String ?? "")", forHTTPHeaderField: "Authorization")
        
        let body: [String: Any] = [
            "user_id": config["user_id"] ?? "",
            "aca_hash_key": acaHash,
            "data": payload,
            "sync_session_id": config["sync_session_id"] ?? "manual_sync"
        ]
        
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        URLSession.shared.dataTask(with: request) { [weak self] _, response, error in
            DispatchQueue.main.async {
                let code = (response as? HTTPURLResponse)?.statusCode ?? 0
                print("🍏 [EGRESS_END] Hub Response: \(code)")
                
                if let error = error {
                    print("🚨 [EGRESS_ERROR] Transmit Failed: \(error.localizedDescription)")
                }
                
                if code == 200 {
                    self?.evaluateSyncSuccess(payload: payload, sessionId: config["sync_session_id"] as? String ?? "manual_sync")
                }
                completion?()
            }
        }.resume()
    }

    private func evaluateSyncSuccess(payload: [[String: Any]], sessionId: String) {
        print("🍏 [JS_INJECT_START] Transmitting success state to WebView...")
        let js = "if(window.onHealthDataSyncComplete){ window.onHealthDataSyncComplete({ sync_session_id: '\(sessionId)', processed_count: \(payload.count) }); }"
        self.webView?.evaluateJavaScript(js) { _, error in
            if let error = error {
                print("🚨 [JS_INJECT_ERROR] Bridge Failed: \(error.localizedDescription)")
            } else {
                print("🍏 [JS_INJECT_END] WebView Hydrated.")
            }
        }
    }

    private func reportErrorToWeb(_ message: String, sessionId: String) {
        let js = "if(window.onHealthDataSyncError){window.onHealthDataSyncError('\(message)', '\(sessionId)');}"
        self.webView?.evaluateJavaScript(js)
    }
}

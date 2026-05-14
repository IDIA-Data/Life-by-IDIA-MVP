import Foundation
import Capacitor
import HealthKit

@objc(IDIAHealthPlugin)
public class IDIAHealthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "IDIAHealthPlugin"
    public let jsName = "IDIAHealth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "checkAvailability", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getHealthData", returnType: CAPPluginReturnPromise),
    ]
    private let healthStore = HKHealthStore()
    private var readTypes: Set<HKObjectType> {
        var types: Set<HKObjectType> = []
        for id in [HKQuantityTypeIdentifier.stepCount, .heartRate, .activeEnergyBurned, .distanceWalkingRunning, .bodyMass, .height] as [HKQuantityTypeIdentifier] {
            if let t = HKObjectType.quantityType(forIdentifier: id) { types.insert(t) }
        }
        if let s = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) { types.insert(s) }
        return types
    }
    @objc func checkAvailability(_ call: CAPPluginCall) { call.resolve(["available": HKHealthStore.isHealthDataAvailable(), "platform": "ios", "apiName": "healthkit"]) }
    @objc func requestPermissions(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else { call.resolve(["granted": false]); return }
        healthStore.requestAuthorization(toShare: nil, read: readTypes) { s, _ in call.resolve(["granted": s]) }
    }
    @objc func checkPermissions(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else { call.resolve(["granted": false]); return }
        let st = HKObjectType.quantityType(forIdentifier: .stepCount)!
        call.resolve(["granted": self.healthStore.authorizationStatus(for: st) != .notDetermined])
    }
    @objc func getHealthData(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else { call.reject("HealthKit not available"); return }
        let fmt = ISO8601DateFormatter(); fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let start = fmt.date(from: call.getString("startDate") ?? "") ?? Calendar.current.startOfDay(for: Date())
        let end = fmt.date(from: call.getString("endDate") ?? "") ?? Date()
        let group = DispatchGroup()
        var result: [String: Any] = ["recorded_at": ISO8601DateFormatter().string(from: Date()), "source": "apple_health", "device_type": UIDevice.current.model, "type": "health_metrics"]
        group.enter(); fetchSum(.stepCount, .count(), start, end) { v in if let v = v { result["steps"] = Int(v) }; group.leave() }
        group.enter(); fetchRecent(.heartRate, HKUnit.count().unitDivided(by: .minute()), start, end) { v in if let v = v { result["heartRate"] = Int(v) }; group.leave() }
        group.enter(); fetchSum(.activeEnergyBurned, .kilocalorie(), start, end) { v in if let v = v { result["calories"] = Int(v) }; group.leave() }
        group.enter(); fetchSum(.distanceWalkingRunning, .meter(), start, end) { v in if let v = v { result["distance"] = v }; group.leave() }
        group.enter(); fetchRecent(.bodyMass, .gramUnit(with: .kilo), start, end) { v in if let v = v { result["weight"] = v }; group.leave() }
        group.notify(queue: .main) { call.resolve(result as! [String: Any]) }
    }
    private func fetchSum(_ id: HKQuantityTypeIdentifier, _ unit: HKUnit, _ s: Date, _ e: Date, _ c: @escaping (Double?) -> Void) {
        guard let qt = HKQuantityType.quantityType(forIdentifier: id) else { c(nil); return }
        let q = HKStatisticsQuery(quantityType: qt, quantitySamplePredicate: HKQuery.predicateForSamples(withStart: s, end: e, options: .strictStartDate), options: .cumulativeSum) { _, r, _ in c(r?.sumQuantity()?.doubleValue(for: unit)) }
        healthStore.execute(q)
    }
    private func fetchRecent(_ id: HKQuantityTypeIdentifier, _ unit: HKUnit, _ s: Date, _ e: Date, _ c: @escaping (Double?) -> Void) {
        guard let st = HKSampleType.quantityType(forIdentifier: id) else { c(nil); return }
        let q = HKSampleQuery(sampleType: st, predicate: HKQuery.predicateForSamples(withStart: s, end: e, options: .strictEndDate), limit: 1, sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]) { _, samples, _ in c((samples?.first as? HKQuantitySample)?.quantity.doubleValue(for: unit)) }
        healthStore.execute(q)
    }
}

import SwiftUI
import WebKit
import AuthenticationServices
import UIKit
import CoreMotion
import AVFoundation

// MARK: - IDIA Protocol: Unified Entry Point
struct ContentView: View {
    @StateObject private var healthKitManager = HealthKitManager()
    private let lovableAppURL = URL(string: "https://life.thebigidia.com")!

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            IDIAWebView(url: lovableAppURL, healthKitManager: healthKitManager)
                .ignoresSafeArea()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .onOpenURL { url in
            handleDeepLink(url: url)
        }
    }

    private func handleDeepLink(url: URL) {
        print("🔗 [DEEPLINK_LOG] START: Processing URL: \(url.absoluteString)")
        if url.scheme == "idialife" && url.host == "auth-callback" {
            print("🔗 [DEEPLINK_LOG] ACTION: Internal handshake callback detected.")
            print("🔗 [DEEPLINK_LOG] END: Handled auth-callback")
            return
        }

        if url.scheme == "idialife" && url.host == "update-password" {
            if let fragment = url.fragment, let activeWebView = healthKitManager.webView {
                let webTarget = "https://life.thebigidia.com/update-password#\(fragment)"
                DispatchQueue.main.async {
                    print("🔗 [DEEPLINK_LOG] ACTION: Redirecting to update-password target")
                    activeWebView.evaluateJavaScript("window.location.replace('\(webTarget)');") { _, error in
                        if let error = error {
                            print("🚨 [DEEPLINK_LOG] ERROR: JS Replace failed: \(error.localizedDescription)")
                        }
                        print("🔗 [DEEPLINK_LOG] END: Completed update-password routing")
                    }
                }
            } else {
                print("🚨 [DEEPLINK_LOG] ERROR: Fragment missing or activeWebView null")
                print("🔗 [DEEPLINK_LOG] END: Failed update-password routing")
            }
        } else {
            print("🔗 [DEEPLINK_LOG] END: URL did not match known routes")
        }
    }
}

// MARK: - LEAK PREVENTION
class LeakSafeHandler: NSObject, WKScriptMessageHandler {
    weak var delegate: WKScriptMessageHandler?
    init(delegate: WKScriptMessageHandler) { self.delegate = delegate }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        delegate?.userContentController(userContentController, didReceive: message)
    }
}

// MARK: - IDIA Liability Shield-Compliant WebView (Spatial Hydration)
struct IDIAWebView: UIViewRepresentable {
    let url: URL
    let healthKitManager: HealthKitManager

    // The Coordinator acts as the persistent brain, surviving SwiftUI struct redraws.
    class Coordinator: NSObject, WKScriptMessageHandler, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding, WKUIDelegate, WKNavigationDelegate {
        func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
            print("🛡️ [APPLE_SIGN_IN_ANCHOR_LOG] START: Fetching presentation anchor for ASAuthorizationController")
            let windowScene = UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene
            let window = windowScene?.windows.first(where: { $0.isKeyWindow }) ?? UIWindow()
            print("🛡️ [APPLE_SIGN_IN_ANCHOR_LOG] END: Returned key window as presentation anchor")
            return window
        }

        // MARK: - MICROPHONE PERMISSION OVERRIDE (iOS 15+)
        @available(iOS 15.0, *)
        func webView(
            _ webView: WKWebView,
            requestMediaCapturePermissionFor origin: WKSecurityOrigin,
            initiatedByFrame frame: WKFrameInfo,
            type: WKMediaCaptureType,
            decisionHandler: @escaping (WKPermissionDecision) -> Void
        ) {
            print("🎤 [MIC_AUTH_LOG] WebKit requesting media capture for: \(origin.host)")
            decisionHandler(.grant)
        }

        private var isDomReady = false
        var parent: IDIAWebView
        var healthKitManager: HealthKitManager
        var popupWebView: WKWebView?
        var authSession: ASWebAuthenticationSession?
        
        // Initialize NFC Manager
        private let nfcManager = NFCManager()
        
        // Motion Management securely contained
        private let motionManager = CMMotionManager()
        private var isEvaluatingJS = false
        
        // Memory Leak Safeguards: Deadband Filter Variables
        private var lastPitch: Double = 0.0
        private var lastRoll: Double = 0.0

        init(_ parent: IDIAWebView) {
            self.parent = parent
            self.healthKitManager = parent.healthKitManager
            super.init()
            print("🧠 [COORDINATOR_LOG] START: Initialized WKWebView Coordinator")
            print("🧠 [COORDINATOR_LOG] END: Initialization complete")
        }
        
        deinit {
            print("🧹 [COORDINATOR_LOG] START: Deinitializing Coordinator")
            motionManager.stopDeviceMotionUpdates()
            print("🧹 [COORDINATOR_LOG] END: Motion updates stopped")
        }

        // MARK: - JavaScript Bridge / Messages
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            print("📱 [BRIDGE_LOG] Message received: \(message.name)")

            var payload: [String: Any] = [:]
            if let dict = message.body as? [String: Any] {
                payload = dict
            } else if let str = message.body as? String, let data = str.data(using: .utf8) {
                payload = (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
            }

            // --- initiateNfcHandshake HANDLER (For USDC Settlement Modal) ---
            if message.name == "initiateNfcHandshake" {
                print("🛜 [NFC_SETTLEMENT_LOG] START: Financial Handshake Triggered")
                self.nfcManager.beginHandshake(withConfig: payload) { [weak self] result in
                    DispatchQueue.main.async {
                        guard let self = self else { return }
                        switch result {
                        case .success(let jsonResponse):
                            print("✅ [NFC_SETTLEMENT_LOG] SUCCESS: Returning Payload to React Verifier")
                            let js = "if (window.onNfcHandshakeComplete) { window.onNfcHandshakeComplete(\(jsonResponse)); }"
                            self.healthKitManager.webView?.evaluateJavaScript(js)
                        case .failure(let error):
                            print("🚨 [NFC_SETTLEMENT_LOG] ERROR: \(error.localizedDescription)")
                            let js = "if (window.onNfcHandshakeError) { window.onNfcHandshakeError('\(error.localizedDescription)'); }"
                            self.healthKitManager.webView?.evaluateJavaScript(js)
                        }
                    }
                }
            }

            // --- NFCBridge HANDLER (Legacy/Custom Event Support) ---
            if message.name == "NFCBridge" {
                let type = payload["type"] as? String ?? ""
                let mode = payload["mode"] as? String ?? "STANDARD"

                if type == "INITIATE_SYNC" {
                    self.nfcManager.beginHandshake(withConfig: ["mode": mode]) { [weak self] result in
                        DispatchQueue.main.async {
                            guard let self = self else { return }
                            switch result {
                            case .success(let peerToken):
                                let js = "window.dispatchEvent(new CustomEvent('nfc:scan-complete', { detail: { peerToken: '\(peerToken)' } }));"
                                self.healthKitManager.webView?.evaluateJavaScript(js)
                            case .failure(let error):
                                let js = "window.dispatchEvent(new CustomEvent('nfc:scan-error', { detail: { error: '\(error.localizedDescription)' } }));"
                                self.healthKitManager.webView?.evaluateJavaScript(js)
                            }
                        }
                    }
                }
            }

            // --- syncHealthData ---
            if message.name == "syncHealthData" {
                self.healthKitManager.triggerHealthDataSync(withConfig: payload, requestedDataTypes: [:])
            }

            // --- appleSignIn ---
            if message.name == "appleSignIn" {
                let provider = ASAuthorizationAppleIDProvider()
                let request = provider.createRequest()
                request.requestedScopes = [.fullName, .email]
                let authController = ASAuthorizationController(authorizationRequests: [request])
                authController.delegate = self
                authController.presentationContextProvider = self
                authController.performRequests()
            }
        }
        
        func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
            print("🚨 [APPLE_AUTH_LOG] START: Authorization Failed")
            print("🚨 [APPLE_AUTH_LOG] ERROR: \(error.localizedDescription)")
            print("🚨 [APPLE_AUTH_LOG] END: Authorization Failed")
        }

        // MARK: - Navigation & Silent Stall Detection
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            print("💥 [WEB_CRASH_LOG] START: WebContent Process Terminated (Jetsam OOM Kill Detected)")
            print("💥 [WEB_CRASH_LOG] ACTION: Reloading WebView to recover state")
            webView.reload()
            print("💥 [WEB_CRASH_LOG] END: Recovery reload initiated")
        }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            print("🌐 [WEB_NAV_LOG] SUCCESS: DOM fully loaded. Releasing Spatial Engine gate.")
            self.isDomReady = true
        }
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            print("🚨 [WEB_NAV_LOG] START: Navigation Failed")
            print("🚨 [WEB_NAV_LOG] ERROR: \(error.localizedDescription)")
            print("🚨 [WEB_NAV_LOG] END: Navigation Failed")
        }
        
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            print("🚨 [WEB_NAV_LOG] START: Provisional Navigation Failed")
            print("🚨 [WEB_NAV_LOG] ERROR: \(error.localizedDescription)")
            print("🚨 [WEB_NAV_LOG] END: Provisional Navigation Failed")
        }

        // MARK: - WKUIDelegate: THE COINBASE/BASE HANDSHAKE FIX
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            let targetURL = navigationAction.request.url?.absoluteString ?? "UNKNOWN"
            print("🌐 [WEB_UI_LOG] START: Handshake Intercepted. Target: \(targetURL)")

            if targetURL.contains("coinbase.com") && (targetURL.contains("oauth") || targetURL.contains("authorize")) {
                print("🛡️ [WEB_UI_LOG] ACTION: Shifting to ASWebAuthenticationSession for Passkey compliance.")
                self.startSecureAuthSession(url: navigationAction.request.url!)
                print("🌐 [WEB_UI_LOG] END: Returning nil to prevent unhandled popup")
                return nil
            }

            print("🌐 [WEB_UI_LOG] ACTION: Creating standard child WebView popup")
            configuration.websiteDataStore = .default()
            let childWebView = WKWebView(frame: webView.window?.frame ?? UIScreen.main.bounds, configuration: configuration)
            childWebView.uiDelegate = self
            childWebView.navigationDelegate = self
            childWebView.translatesAutoresizingMaskIntoConstraints = true
            childWebView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            
            if let window = webView.window {
                window.addSubview(childWebView)
                window.bringSubviewToFront(childWebView)
                self.popupWebView = childWebView
                print("🌐 [WEB_UI_LOG] END: Child WebView successfully attached")
                return childWebView
            }
            
            print("🚨 [WEB_UI_LOG] ERROR: Parent window missing")
            print("🌐 [WEB_UI_LOG] END: Failed to attach child WebView")
            return nil
        }
        
        // MARK: - SECURE AUTH SESSION BRIDGE
        func startSecureAuthSession(url: URL) {
            print("🛡️ [AUTH_SESSION_LOG] START: Initiating secure session")
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: "idialife") { callbackURL, error in
                print("🛡️ [AUTH_SESSION_LOG] ACTION: Callback triggered")
                if let error = error {
                    print("🚨 [AUTH_SESSION_LOG] ERROR: Session failed: \(error.localizedDescription)")
                    print("🛡️ [AUTH_SESSION_LOG] END: Session terminated with error")
                    return
                }
                
                if let callbackURL = callbackURL {
                    print("🛡️ [AUTH_SESSION_LOG] SUCCESS: Handshake captured. Hydrating parent.")
                    let jsInjection = "window.postMessage({ type: 'IDIA_AUTH_COMPLETE', url: '\(callbackURL.absoluteString)' }, '*');"
                    DispatchQueue.main.async {
                        self.healthKitManager.webView?.evaluateJavaScript(jsInjection) { _, error in
                            if let error = error {
                                print("🚨 [AUTH_SESSION_LOG] ERROR: JS Injection failed: \(error.localizedDescription)")
                            }
                            print("🛡️ [AUTH_SESSION_LOG] END: Parent hydration complete")
                        }
                    }
                }
            }
            
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.authSession = session
            session.start()
            print("🛡️ [AUTH_SESSION_LOG] END: Secure session successfully started")
        }

        func webViewDidClose(_ webView: WKWebView) {
            print("🌐 [WEB_UI_LOG] START: webViewDidClose triggered")
            webView.removeFromSuperview()
            if self.popupWebView == webView { self.popupWebView = nil }
            print("🌐 [WEB_UI_LOG] END: WebView cleaned up")
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }

            if url.scheme == "idialife" {
                print("🌐 [NAV_POLICY_LOG] START: Intercepted idialife scheme")
                let absoluteString = url.absoluteString
                let jsInjection = "window.postMessage({ type: 'IDIA_AUTH_COMPLETE', url: '\(absoluteString)' }, '*');"
                DispatchQueue.main.async {
                    self.healthKitManager.webView?.evaluateJavaScript(jsInjection) { _, error in
                        if let error = error {
                            print("🚨 [NAV_POLICY_LOG] ERROR: JS injection failed: \(error.localizedDescription)")
                        }
                        if let popup = self.popupWebView {
                            popup.removeFromSuperview()
                            self.popupWebView = nil
                            print("🌐 [NAV_POLICY_LOG] ACTION: Removed popup webview")
                        }
                        print("🌐 [NAV_POLICY_LOG] END: Completed internal scheme handling")
                    }
                }
                decisionHandler(.cancel)
                return
            }

            let walletSchemes = ["cbwallet", "wc", "ethereum", "metamask"]
            if let scheme = url.scheme?.lowercased(), walletSchemes.contains(scheme) {
                print("🌐 [NAV_POLICY_LOG] START: Intercepted external wallet scheme: \(scheme)")
                if UIApplication.shared.canOpenURL(url) {
                    UIApplication.shared.open(url, options: [:]) { success in
                        if success {
                            print("🌐 [NAV_POLICY_LOG] ACTION: Opened external wallet app successfully")
                        } else {
                            print("🚨 [NAV_POLICY_LOG] ERROR: Failed to open external wallet app")
                        }
                        print("🌐 [NAV_POLICY_LOG] END: Handled wallet scheme")
                    }
                    decisionHandler(.cancel)
                    return
                }
                print("🚨 [NAV_POLICY_LOG] ERROR: Cannot open URL for scheme: \(scheme)")
                print("🌐 [NAV_POLICY_LOG] END: Failed to handle wallet scheme")
            }
            decisionHandler(.allow)
        }
        
        // MARK: - Spatial Hydration Engine (Optimized for Jetsam Memory Limits)
        func startSpatialEngine(for webView: WKWebView) {
            print("⚙️ [MOTION_LOG] START: Booting Spatial Engine with Deadband Safeties")
            guard motionManager.isDeviceMotionAvailable else {
                print("🚨 [MOTION_LOG] ERROR: Device motion unavailable")
                return
            }
            
            motionManager.deviceMotionUpdateInterval = 1.0 / 30.0
            motionManager.startDeviceMotionUpdates(to: .main) { [weak self] (motion, error) in
                guard let self = self else { return }
                guard self.isDomReady else { return } // Wait for network
                guard let attitude = motion?.attitude else { return }
                
                let pitchDelta = abs(attitude.pitch - self.lastPitch)
                let rollDelta = abs(attitude.roll - self.lastRoll)
                
                // DEADBAND FILTER
                guard pitchDelta > 0.01 || rollDelta > 0.01 else { return }
                guard !self.isEvaluatingJS else { return }
                
                self.isEvaluatingJS = true
                self.lastPitch = attitude.pitch
                self.lastRoll = attitude.roll
                
                // let js = String(format: "document.documentElement.style.setProperty('--pitch', %.3f); document.documentElement.style.setProperty('--roll', %.3f);", attitude.pitch, attitude.roll)
                // (Optimized: Silencing log spam but keeping logic live)
                
                let js = String(format: "document.documentElement.style.setProperty('--pitch', %.3f); document.documentElement.style.setProperty('--roll', %.3f);", attitude.pitch, attitude.roll)
                
                webView.evaluateJavaScript(js) { _, error in
                    self.isEvaluatingJS = false
                    if let error = error {
                        // print("🚨 [MOTION_LOG] ERROR: JS Execution failed: \(error.localizedDescription)")
                    }
                }
            }
            print("⚙️ [MOTION_LOG] END: Spatial Engine running successfully")
        }
    }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let controller = config.userContentController
        
        // Wrap the coordinator to break reference cycles
        let safeCoordinator = LeakSafeHandler(delegate: context.coordinator)
        
        controller.add(safeCoordinator, name: "syncHealthData")
        controller.add(safeCoordinator, name: "appleSignIn")
        controller.add(safeCoordinator, name: "NFCBridge")
        controller.add(safeCoordinator, name: "initiateNfcHandshake") // PRODUCTION HARDWARE TRIGGER

        // --- MEDIA CONFIGURATIONS ---
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = [] // Allow autoplay for mic/audio
        
        config.applicationNameForUserAgent = "IDIA-Native-Shell"
        
        // Force a log into Safari Inspector the moment the page starts loading
        let heartbeat = WKUserScript(source: "console.log('✅ [NATIVE] NFCBridge Interface Injected');",
                                     injectionTime: .atDocumentStart,
                                     forMainFrameOnly: false)
        controller.addUserScript(heartbeat)

        config.websiteDataStore = .default()
        
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.uiDelegate = context.coordinator
        webView.navigationDelegate = context.coordinator
        healthKitManager.webView = webView
        
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        context.coordinator.startSpatialEngine(for: webView)
        
        return webView
    }
    
    func updateUIView(_ uiView: WKWebView, context: Context) {
        if uiView.url == nil {
            print("🖥️ [VIEW_LOG] START: updateUIView triggered - URL is nil")
            uiView.load(URLRequest(url: url))
            print("🖥️ [VIEW_LOG] END: Loaded default URLRequest")
        }
    }
}

// EXTENSION FOR ASWebAuthenticationSession Support
extension IDIAWebView.Coordinator: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        print("🛡️ [AUTH_ANCHOR_LOG] START: Fetching presentation anchor for ASWebAuthenticationSession")
        
        let windowScene = UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene
        let window = windowScene?.windows.first(where: { $0.isKeyWindow }) ?? UIWindow()
        
        print("🛡️ [AUTH_ANCHOR_LOG] END: Returned key window as presentation anchor")
        return window
    }
}

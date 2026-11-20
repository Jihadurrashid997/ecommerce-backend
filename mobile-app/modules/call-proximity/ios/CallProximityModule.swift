import ExpoModulesCore
import UIKit

public class CallProximityModule: Module {
  private var proximityObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("CallProximity")
    Events("onProximityChanged")

    AsyncFunction("start") { () -> Bool in
      self.startMonitoring()
    }
    .runOnQueue(.main)

    AsyncFunction("stop") {
      self.stopMonitoring()
    }
    .runOnQueue(.main)

    OnDestroy {
      DispatchQueue.main.async {
        self.stopMonitoring()
      }
    }
  }

  private func startMonitoring() -> Bool {
    let device = UIDevice.current
    device.isProximityMonitoringEnabled = true
    guard device.isProximityMonitoringEnabled else {
      return false
    }

    if proximityObserver == nil {
      proximityObserver = NotificationCenter.default.addObserver(
        forName: UIDevice.proximityStateDidChangeNotification,
        object: device,
        queue: .main
      ) { [weak self] _ in
        self?.sendProximityState()
      }
    }

    sendProximityState()
    return true
  }

  private func sendProximityState() {
    sendEvent(
      "onProximityChanged",
      ["near": UIDevice.current.proximityState]
    )
  }

  private func stopMonitoring() {
    if let proximityObserver {
      NotificationCenter.default.removeObserver(proximityObserver)
      self.proximityObserver = nil
    }
    UIDevice.current.isProximityMonitoringEnabled = false
  }
}

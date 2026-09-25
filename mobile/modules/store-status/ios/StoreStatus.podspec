Pod::Spec.new do |s|
  s.name           = 'StoreStatus'
  s.version        = '1.0.0'
  s.summary        = 'Read-only view of the Apple ID’s current subscriptions'
  s.description    = 'Reads StoreKit 2 current entitlements without restoring, syncing or prompting.'
  s.author         = 'Dozy Labs LLC'
  s.homepage       = 'https://revely.life'
  s.license        = { :type => 'UNLICENSED' }
  s.platforms      = { :ios => '16.4' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.swift'
end

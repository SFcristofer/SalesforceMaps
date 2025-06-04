public with sharing class UbicacionEventPublisher {
    @AuraEnabled
    public static void enviarEventoUbicacion(Decimal lat, Decimal lon) {
        // Obtener el usuario actual
        User u = [SELECT Name FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
        
        Ubicacion_Event__e evento = new Ubicacion_Event__e(
            Lat__c = lat,
            Lon__c = lon,
            UsuarioId__c = u.Id,
            UsuarioNombre__c = u.Name,
            Fecha__c = System.now()
        );
        
        EventBus.publish(evento);
    }
}

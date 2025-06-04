public with sharing class UbicacionController {
    @AuraEnabled
    public static void guardarUbicacion(Double lat, Double lon) {
        Ubicacion__c ubi = new Ubicacion__c();
        ubi.Vendedor__c = UserInfo.getUserId();
        ubi.Ubicacion__Latitude__s = lat;
        ubi.Ubicacion__Longitude__s = lon;
        ubi.Fecha__c = System.now();
        insert ubi;
    }

    @AuraEnabled(cacheable=true)
    public static Ubicacion__c obtenerUltimaUbicacion(Id userId) {
        return [
            SELECT Ubicacion__Latitude__s, Ubicacion__Longitude__s, Fecha__c
            FROM Ubicacion__c
            WHERE Vendedor__c = :userId
            ORDER BY Fecha__c DESC
            LIMIT 1
        ];
    }

    @AuraEnabled(cacheable=true)
    public static String obtenerDireccionDesdeCoordenadas(Double lat, Double lon) {
        String url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lon;
        HttpRequest req = new HttpRequest();
        req.setEndpoint(url);
        req.setMethod('GET');
        req.setHeader('User-Agent', 'SalesforceApp'); // Requerido por Nominatim
        Http http = new Http();
        HttpResponse res = http.send(req);

        if (res.getStatusCode() == 200) {
            Map<String, Object> jsonMap = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
            if (jsonMap.containsKey('display_name')) {
                return (String) jsonMap.get('display_name');
            }
            return 'Ubicación no encontrada';
        } else {
            return 'Error: ' + res.getStatus();
        }
    }
   @AuraEnabled(cacheable=true)
public static List<Ubicacion__c> obtenerUltimasUbicaciones() {
    // Obtener última fecha por vendedor
    List<AggregateResult> resultados = [
        SELECT Vendedor__c, MAX(Fecha__c) fecha
        FROM Ubicacion__c
        GROUP BY Vendedor__c
    ];

    Set<String> claves = new Set<String>();
    for (AggregateResult ar : resultados) {
        Id vendedorId = (Id) ar.get('Vendedor__c');
        Datetime fecha = (Datetime) ar.get('fecha');
        claves.add(vendedorId + '|' + String.valueOf(fecha.getTime()));
    }

    // Obtener todas las ubicaciones y filtrar por las claves
    List<Ubicacion__c> todas = [
        SELECT Vendedor__c, Vendedor__r.Name, Ubicacion__Latitude__s, Ubicacion__Longitude__s, Fecha__c
        FROM Ubicacion__c
        ORDER BY Fecha__c DESC
    ];

    List<Ubicacion__c> ultimasUbicaciones = new List<Ubicacion__c>();
    Set<Id> vendedoresYaAgregados = new Set<Id>();

    for (Ubicacion__c u : todas) {
        String clave = u.Vendedor__c + '|' + String.valueOf(u.Fecha__c.getTime());
        if (claves.contains(clave) && !vendedoresYaAgregados.contains(u.Vendedor__c)) {
            ultimasUbicaciones.add(u);
            vendedoresYaAgregados.add(u.Vendedor__c);
        }
    }

    return ultimasUbicaciones;
}

}

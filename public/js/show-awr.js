/* vim: set ts=2 sw=2 expandtab : */
  
var table;

function loadHostInfo() {
  chart = hostCpuGraph('#host-cpu-chart', $('#ds_id').text(), $('#host-sel').val());
  table = $('#host-info-table').DataTable( {
    ajax: {
      url: '/api/table',
      data: {
        ds: $('#ds_id').text(),
        dimensions: [ { name: 'Host Name', val: $('#host-sel').val() }, ],
        category: 'Host information',
      },
      method: 'POST',
    },
    dom: '',
  });
}

$(document).ready(function() {
  table = $('#awr-ds-table').DataTable( {
    ajax: {
      url: '/api/ds-for-awr',
      data: {
        awr: $('#awr_id').text(),
      },
      method: 'GET',
    },
    dom: '',
    columnDefs : [
      {
        targets: 0,
        render: function(data, type, row) {
          return '<a href="/show-ds?id=' + data + '">' + data + '</a>';
        },
      },
      {
        targets: 2,
        render: function(data, type, row) {
          return dateFormat(data, 'yyyy-mm-dd HH:MM:ss');
        },
      },
    ],
  });
});



/* vim: set ts=2 sw=2 expandtab : */
  
var chart;
var table;

function hostCpuGraph(bind, ds, host) {
  var ret;
	$.ajax({
    url: '/api/graph',
    data: {
            ds: ds,
            dimensions: [ { name: 'Host Name', val: host }, ],
            names: [ 'CPU %User', 'CPU %System' ],
    },
    type: 'POST',
    success: function(result) {
      ret = c3.generate({
        bindto: bind,
        data: result,
        axis: {
          x: {
            type: 'timeseries',
            tick: {
                    format: '%Y-%m-%d %H:%M'
            }
          },
          y: {
            min: 0+1,
            max: 100-1,
            label: '(%)',
          },
        },
        legend: {
          position: 'right',
        },
        zoom: {
          enabled: true,
        },
        grid: {
          x: {
            show: true
          },
          y: {
            show: true
          }
        },
      });
    }
  });
  return ret;
}

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

  var $select = $('#host-sel');

  
  $.ajax({
    url: '/api/ds-hosts',
    type: 'get',
    data: { id: $('#ds_id').text() },
    success: function(ret) {
      ret.forEach(function(opt) {
        $('<option>').val(opt).text(opt).appendTo($select);
      });
      loadHostInfo();
    },
  });
 
  $select.change(function() {
    table.destroy();
    loadHostInfo();
  });

 
});


